const express = require('express');
const router = express.Router();

const stripe = require('../config/stripe');

const Payment = require('../models/payment.model');
const User = require('../models/user.model');
const WebhookEvent = require('../models/webhookEvent.model');

const { resolvePlanFromPriceId } = require('../config/plans');

const {
   setUserPlan,
   markPastDue,
   downgradeToFree,
   clearStripeCustomer
} = require('../services/payment.service');

const {
   syncPriceFromStripe,
   upsertProductFromStripe,
   deactivateProduct,
   deactivatePrice
} = require('../services/planSync.service');

const { withTransactionRetry } = require('../utils/mongoTransaction');

/**
 * =====================================
 * 🧭 IDEMPOTENCY MODEL (READ THIS FIRST)
 * =====================================
 * The previous version gated ALL processing on "have I seen this event
 * ID before?" — check first, insert a WebhookEvent row, only THEN run
 * the business logic, all inside one transaction. That looks safe but
 * has a real failure window: if the process crashes (or the transaction
 * fails for an unrelated reason) AFTER the WebhookEvent row commits but
 * the state genuinely didn't finish applying, Stripe's retry of that
 * same event ID would be silently swallowed as "already processed" —
 * the event is lost forever, not retried.
 *
 * This version flips the model to match Stripe's own recommendation:
 * make the WRITES idempotent, and treat the events table as an audit
 * log / fast-path optimization, not a correctness gate.
 *   - Payment writes are upsert keyed on Stripe's own IDs
 *     (stripeSessionId / invoiceId), so replaying the same event twice
 *     produces the same row, not a duplicate.
 *   - User subscription writes (setUserPlan/markPastDue/downgradeToFree)
 *     are plain field overwrites — applying the same Stripe state twice
 *     converges to the same result, it's not additive.
 *   - Plan catalog syncs are already idempotent (see planSync.service.js).
 * Because every write converges, it's safe to just log-and-continue on
 * a duplicate delivery instead of skipping business logic entirely.
 */

function getCurrentPeriodEnd(subscription) {
   return (
      subscription.current_period_end ??
      subscription.items?.data?.[0]?.current_period_end ??
      null
   );
}

function resolvePlanFromSubscription(subscription) {

   const priceId = subscription.items?.data?.[0]?.price?.id;

   if (!priceId) {
      throw new Error('Subscription has no price on its line item');
   }

   const resolved = resolvePlanFromPriceId(priceId);

   if (!resolved) {
      throw new Error(`Unrecognized Stripe price ID: ${priceId}`);
   }

   return { ...resolved, priceId };
}

/**
 * Best-effort audit record. Never blocks or gates business logic — see
 * the idempotency-model comment above. Duplicate deliveries are logged,
 * not rejected.
 */
async function recordWebhookEvent(eventId, eventType) {
   try {
      await WebhookEvent.create({ eventId, eventType });
   } catch (err) {
      if (err.code === 11000) {
         console.log(`↻ Duplicate delivery of ${eventType} (${eventId}) — reprocessing idempotently`);
         return;
      }
      // Non-fatal: losing the audit row is not worth failing the whole
      // webhook over, since correctness doesn't depend on it.
      console.error('Failed to record WebhookEvent (non-fatal):', err.message);
   }
}

router.post(
   '/',
   express.raw({ type: 'application/json' }),

   async (req, res) => {

      const signature = req.headers['stripe-signature'];

      let event;

      try {

         event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
         );

      } catch (err) {

         console.error('❌ Invalid Stripe Signature:', err.message);

         return res.status(400).send(`Webhook Error: ${err.message}`);

      }

      // ==========================================
      // EVENT WHITELIST
      // ==========================================
      // NOTE ON WHAT'S DELIBERATELY EXCLUDED:
      // - payment_intent.* events: this app only uses Stripe Checkout
      //   Sessions in `mode: 'subscription'`. Checkout already surfaces
      //   the equivalent outcome via checkout.session.completed /
      //   checkout.session.async_payment_failed and invoice.paid /
      //   invoice.payment_failed. Handling payment_intent.* too would be
      //   processing the same underlying event twice through two
      //   different code paths — add them only if you later build a
      //   custom Elements-based checkout that creates PaymentIntents
      //   directly instead of going through Checkout Sessions.
      // - entitlements.active_entitlement_summary.updated: this is part
      //   of Stripe's Entitlements API (feature-flag-style access
      //   grants), which this app doesn't use — plan features are
      //   derived from Product metadata instead (see
      //   planSync.service.js). Not applicable unless you migrate to
      //   Entitlements.
      // - invoice.finalized: informational only (invoice line items are
      //   locked in), no state change needed on our side — invoice.paid
      //   is what actually confirms money changed hands.
      // - invoice.upcoming: fires ~ a few days before renewal, useful
      //   for a "your subscription renews soon" email, not for state
      //   sync. Add a handler here if/when you build that notification.
      const allowedEvents = [
         'checkout.session.completed',
         'checkout.session.async_payment_succeeded',
         'checkout.session.async_payment_failed',
         'customer.subscription.created',
         'customer.subscription.updated',
         'customer.subscription.deleted',
         'customer.updated',
         'customer.deleted',
         'invoice.paid',
         'invoice.payment_succeeded',
         'invoice.payment_failed',
         'price.created',
         'price.updated',
         'price.deleted',
         'product.created',
         'product.updated',
         'product.deleted'
      ];

      if (!allowedEvents.includes(event.type)) {
         return res.json({ received: true });
      }

      await recordWebhookEvent(event.id, event.type);

      try {

         // ==========================================
         // PLAN CATALOG SYNC — no Mongo transaction needed, these don't
         // touch user/payment data.
         // ==========================================

         if (event.type === 'price.created' || event.type === 'price.updated') {
            await syncPriceFromStripe(event.data.object.id);
            return res.json({ received: true });
         }

         if (event.type === 'price.deleted') {
            await deactivatePrice(event.data.object.id);
            return res.json({ received: true });
         }

         if (event.type === 'product.created' || event.type === 'product.updated') {
            await upsertProductFromStripe(event.data.object.id);
            return res.json({ received: true });
         }

         if (event.type === 'product.deleted') {
            await deactivateProduct(event.data.object.id);
            return res.json({ received: true });
         }

         if (event.type === 'customer.deleted') {
            await withTransactionRetry(async (session) => {
               await clearStripeCustomer(event.data.object.id, { session });
            });
            return res.json({ received: true });
         }

         if (event.type === 'customer.updated') {
            // Nothing to sync today (we don't cache customer email/name
            // locally), but the event is whitelisted so it's visible in
            // logs/audit rather than silently 404ing at the Stripe
            // Dashboard's webhook delivery view.
            return res.json({ received: true });
         }

         // ==========================================
         // EVERYTHING BELOW THIS LINE NEEDS A MONGO TRANSACTION.
         // All Stripe reads happen FIRST, outside the transaction — a
         // transaction should only ever wrap fast local DB writes, never
         // a network round-trip to a third party. Holding a transaction
         // open across a Stripe API call is itself a major cause of the
         // write-conflict retries this file used to paper over.
         // ==========================================

         if (event.type === 'checkout.session.completed') {

            const session = event.data.object;

            if (session.mode !== 'subscription') {
               return res.json({ received: true });
            }

            const stripeSubscription = await stripe.subscriptions.retrieve(
               session.subscription
            );

            const { planKey, interval, priceId } =
               resolvePlanFromSubscription(stripeSubscription);

            const currentPeriodEnd = getCurrentPeriodEnd(stripeSubscription);

            if (!currentPeriodEnd) {
               throw new Error('Unable to determine subscription expiry');
            }

            const expiresAt = new Date(currentPeriodEnd * 1000);
            const latestInvoiceId =
               typeof stripeSubscription.latest_invoice === 'string'
                  ? stripeSubscription.latest_invoice
                  : stripeSubscription.latest_invoice?.id || null;

            await withTransactionRetry(async (dbSession) => {

               const user = await User.findById(
                  session.metadata.internalUserId
               ).session(dbSession);

               if (!user) {
                  throw new Error('User not found');
               }

               // FIX for the duplicate-Payment-row bug: checkout.session.
               // completed AND invoice.paid both fire for a brand-new
               // subscription's first payment. Upsert on invoiceId (when
               // we have it) as well as stripeSessionId, so whichever
               // event lands second updates the same row instead of
               // inserting a second one.
               await Payment.findOneAndUpdate(
                  latestInvoiceId
                     ? { $or: [{ stripeSessionId: session.id }, { invoiceId: latestInvoiceId }] }
                     : { stripeSessionId: session.id },
                  {
                     $setOnInsert: {
                        userId: user._id,
                        stripeSessionId: session.id,
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: session.subscription,
                        stripeEventId: event.id,
                        invoiceId: latestInvoiceId,
                        plan: planKey,
                        billingInterval: interval,
                        amount: session.amount_total / 100,
                        currency: session.currency,
                        status: stripeSubscription.status === 'active' ? 'paid' : 'pending'
                     }
                  },
                  { upsert: true, session: dbSession }
               );

               await setUserPlan(
                  {
                     userId: user._id,
                     stripeCustomerId: session.customer,
                     stripeSubscriptionId: session.subscription
                  },
                  {
                     plan: planKey,
                     billingInterval: interval,
                     stripePriceId: priceId,
                     status: stripeSubscription.status,
                     expiresAt
                  },
                  { session: dbSession }
               );
            });

            console.log(`💳 Plan activated (${planKey}/${interval}) via checkout`);
            return res.json({ received: true });
         }

         if (
            event.type === 'checkout.session.async_payment_succeeded' ||
            event.type === 'checkout.session.async_payment_failed'
         ) {
            // Delayed payment methods (e.g. bank debits) resolve here
            // instead of synchronously in checkout.session.completed.
            // On success, the subscription itself will already have
            // gone active via Stripe and invoice.paid/subscription.
            // updated will do the real sync — this event is mainly a
            // signal for user-facing messaging. On failure, mark the
            // payment failed if we have a row for it yet.
            const session = event.data.object;

            if (event.type === 'checkout.session.async_payment_failed') {
               await withTransactionRetry(async (dbSession) => {
                  await Payment.findOneAndUpdate(
                     { stripeSessionId: session.id },
                     { status: 'failed' },
                     { session: dbSession }
                  );
               });
            }

            return res.json({ received: true });
         }

         if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {

            const invoice = event.data.object;

            const subscriptionId =
               invoice.subscription ||
               invoice.parent?.subscription_details?.subscription;

            if (!subscriptionId) {
               return res.json({ received: true });
            }

            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

            const { planKey, interval, priceId } =
               resolvePlanFromSubscription(stripeSubscription);

            const currentPeriodEnd = getCurrentPeriodEnd(stripeSubscription);

            if (!currentPeriodEnd) {
               throw new Error('Unable to determine subscription expiry');
            }

            const expiresAt = new Date(currentPeriodEnd * 1000);

            await withTransactionRetry(async (dbSession) => {

               const user = await User.findOne({
                  'subscription.stripeCustomerId': invoice.customer
               }).session(dbSession);

               if (!user) {
                  throw new Error('User not found');
               }

               await Payment.findOneAndUpdate(
                  { invoiceId: invoice.id },
                  {
                     $setOnInsert: {
                        userId: user._id,
                        stripeSessionId: null,
                        stripeCustomerId: invoice.customer,
                        stripeSubscriptionId: subscriptionId,
                        stripeEventId: event.id,
                        invoiceId: invoice.id,
                        plan: planKey,
                        billingInterval: interval,
                        amount: invoice.amount_paid / 100,
                        currency: invoice.currency,
                        status: 'paid'
                     }
                  },
                  { upsert: true, session: dbSession }
               );

               await setUserPlan(
                  {
                     userId: null,
                     stripeCustomerId: invoice.customer,
                     stripeSubscriptionId: subscriptionId
                  },
                  {
                     plan: planKey,
                     billingInterval: interval,
                     stripePriceId: priceId,
                     status: stripeSubscription.status,
                     expiresAt
                  },
                  { session: dbSession }
               );
            });

            console.log(`✅ Invoice Paid (${planKey}/${interval})`);
            return res.json({ received: true });
         }

         if (event.type === 'invoice.payment_failed') {

            const invoice = event.data.object;

            const subscriptionId =
               invoice.subscription ||
               invoice.parent?.subscription_details?.subscription;

            if (subscriptionId) {

               // Read the subscription's ACTUAL status from Stripe rather
               // than assuming 'past_due' — depending on your Dashboard's
               // "Manage failed payments" settings, a failed invoice can
               // also leave the subscription at 'unpaid' or move it
               // straight to 'canceled' if retries are exhausted/disabled.
               const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

               await withTransactionRetry(async (dbSession) => {
                  await markPastDue(subscriptionId, stripeSubscription.status, { session: dbSession });
               });
            }

            console.log('❌ Payment Failed — status synced from Stripe');
            return res.json({ received: true });
         }

         if (event.type === 'customer.subscription.deleted') {

            const subscription = event.data.object;

            await withTransactionRetry(async (dbSession) => {
               await downgradeToFree(subscription.id, { session: dbSession });
            });

            console.log('🚫 Subscription Cancelled — downgraded to free');
            return res.json({ received: true });
         }

         if (
            event.type === 'customer.subscription.created' ||
            event.type === 'customer.subscription.updated'
         ) {

            const subscription = event.data.object;

            // Every Stripe subscription status is written through
            // verbatim (see user.model.js) instead of only handling
            // 'active' — trialing/past_due/unpaid/paused/incomplete/
            // incomplete_expired all reach the DB now, so the app can
            // make correct decisions (e.g. isEntitled()) instead of
            // silently collapsing everything into active/not-active.
            const { planKey, interval, priceId } =
               resolvePlanFromSubscription(subscription);

            const currentPeriodEnd = getCurrentPeriodEnd(subscription);

            await withTransactionRetry(async (dbSession) => {
               await setUserPlan(
                  {
                     userId: null,
                     stripeCustomerId: subscription.customer,
                     stripeSubscriptionId: subscription.id
                  },
                  {
                     plan: planKey,
                     billingInterval: interval,
                     stripePriceId: priceId,
                     status: subscription.status,
                     expiresAt: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null
                  },
                  { session: dbSession }
               );
            });

            console.log(`🔄 Subscription ${subscription.status} (${planKey}/${interval})`);
            return res.json({ received: true });
         }

         return res.json({ received: true });

      } catch (err) {

         console.error('🔥 Webhook Error:', err);

         // Non-2xx tells Stripe to retry with backoff — correct here
         // since our writes are idempotent (see the model comment at the
         // top of this file), so a retry is always safe, never harmful.
         return res.status(500).json({
            success: false,
            message: err.message
         });

      }

   }
);

module.exports = router;
