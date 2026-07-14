const crypto = require('crypto');
const stripe = require('../config/stripe');
const User = require('../models/user.model');
const { resolvePriceId } = require('../config/plans');

/**
 * =====================================
 * 👤 FIND-OR-CREATE STRIPE CUSTOMER (race-safe, never duplicates)
 * =====================================
 * WHY THIS CHANGED:
 * - The old version read `user.subscription.stripeCustomerId` off a
 *   User document that may already be stale (e.g. the user double-
 *   clicked "Subscribe", or two tabs both hit /checkout at once), then
 *   created a Stripe customer unconditionally if that field was empty.
 *   Two concurrent requests could both see "no customer yet" and both
 *   create one — the second write to Mongo silently overwrites the
 *   first, permanently orphaning a real Stripe customer object with no
 *   user pointing at it.
 * - Fix is two layers:
 *   1. An atomic, conditional Mongo write: only claim the new customer
 *      ID if the field is STILL null at write time (findOneAndUpdate
 *      with that as a filter condition), not a blind update.
 *   2. A DB-level backstop: `subscription.stripeCustomerId` now has a
 *      sparse unique index (see user.model.js) — even if the app-level
 *      guard were somehow bypassed, Mongo itself will reject a second
 *      user claiming the same customer ID.
 * - If the conditional write loses the race (another request won),
 *   we re-read the now-current customer ID from Mongo instead of
 *   proceeding with the orphaned one we just created, and clean the
 *   orphan up in Stripe.
 */
const findOrCreateStripeCustomer = async (user) => {

   const existing = user.subscription?.stripeCustomerId;
   if (existing) return existing;

   const customer = await stripe.customers.create({
      email: user.email,
      metadata: { internalUserId: user._id.toString() }
   });

   const claimed = await User.findOneAndUpdate(
      { _id: user._id, 'subscription.stripeCustomerId': null },
      { 'subscription.stripeCustomerId': customer.id },
      { new: true }
   );

   if (claimed) {
      return customer.id;
   }

   // Lost the race — someone else's concurrent request already set a
   // customer ID on this user between our read and our write. Delete
   // the orphan Stripe customer we just created and use the winner's.
   await stripe.customers.del(customer.id).catch(() => {});

   const fresh = await User.findById(user._id).select('subscription.stripeCustomerId');

   if (!fresh?.subscription?.stripeCustomerId) {
      throw new Error('Failed to resolve Stripe customer after concurrent create');
   }

   return fresh.subscription.stripeCustomerId;
};

/**
 * =====================================
 * 💳 CREATE CHECKOUT SESSION
 * =====================================
 */
const createCheckoutSession = async (user, planKey, interval, options = {}) => {

   if (!user) {
      throw new Error('User is required');
   }

   if (user.isBanned) {
      throw new Error('Account is banned');
   }

   const priceId = resolvePriceId(planKey, interval);

   if (!priceId) {
      throw new Error('Invalid plan or billing interval');
   }

   if (!process.env.STRIPE_SUCCESS_URL) {
      throw new Error('STRIPE_SUCCESS_URL missing');
   }

   if (!process.env.STRIPE_CANCEL_URL) {
      throw new Error('STRIPE_CANCEL_URL missing');
   }

   const customerId = await findOrCreateStripeCustomer(user);

   const subscriptionData = {
      metadata: {
         internalUserId: user._id.toString(),
         planKey,
         interval
      }
   };

   // Optional trial support — pass { trialDays: 14 } from the controller
   // if/when you want trials on checkout. Left opt-in rather than
   // always-on since not every plan should get one.
   if (Number.isInteger(options.trialDays) && options.trialDays > 0) {
      subscriptionData.trial_period_days = options.trialDays;
   }

   const createParams = {

      mode: 'subscription',

      payment_method_types: ['card'],

      line_items: [
         {
            price: priceId,
            quantity: 1
         }
      ],

      metadata: {
         internalUserId: user._id.toString(),
         planKey,
         interval
      },

      subscription_data: subscriptionData,

      customer: customerId,

      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,

      billing_address_collection: 'required',

      allow_promotion_codes: true

   };

   // Automatic tax is opt-in via env var — enabling it requires you to
   // have set up Stripe Tax (origin address, tax registrations) in the
   // Dashboard first, or every session creation call will fail. Once
   // that's done, flip STRIPE_AUTOMATIC_TAX=true and this activates with
   // no further code changes.
   if (process.env.STRIPE_AUTOMATIC_TAX === 'true') {
      createParams.automatic_tax = { enabled: true };
   }

   // Idempotency key: protects against the case where a client retries
   // a /checkout POST (flaky network, double-tap on mobile) — Stripe
   // will return the SAME Checkout Session instead of creating a second
   // one, for any repeat request using this same key within 24h. Keyed
   // on user+plan+interval+a coarse time bucket so genuine repeat
   // subscribe attempts (e.g. resubscribing next month) still get a
   // fresh session, but rapid retries of the same click don't double up.
   const idempotencyKey =
      options.idempotencyKey ||
      crypto
         .createHash('sha256')
         .update(`checkout:${user._id}:${planKey}:${interval}:${Math.floor(Date.now() / 60000)}`)
         .digest('hex');

   const session = await stripe.checkout.sessions.create(
      createParams,
      { idempotencyKey }
   );

   return session;

};

/**
 * =====================================
 * 🔄 CHANGE SUBSCRIPTION PLAN
 * =====================================
 */
const changeSubscriptionPlan = async (subscriptionId, newPriceId) => {

   if (!subscriptionId) {
      throw new Error('Subscription ID required');
   }

   if (!newPriceId) {
      throw new Error('New price ID required');
   }

   const subscription = await stripe.subscriptions.retrieve(subscriptionId);

   if (!subscription) {
      throw new Error('Subscription not found');
   }

   const currentItem = subscription.items?.data?.[0];

   if (!currentItem) {
      throw new Error('Subscription has no items');
   }

   // Already on same plan
   if (currentItem.price.id === newPriceId) {
      return {
         changed: false,
         subscription
      };
   }

   const updated = await stripe.subscriptions.update(
      subscriptionId,
      {
         items: [
            {
               id: currentItem.id,
               price: newPriceId
            }
         ],
         proration_behavior: 'always_invoice'
      }
   );

   return {
      changed: true,
      subscription: updated
   };

};

/**
 * =====================================
 * ❌ CANCEL SUBSCRIPTION
 * =====================================
 * `atPeriodEnd: true` schedules cancellation for the end of the current
 * billing period (customer keeps access until then, no refund needed) —
 * the common "cancel my plan" UX. `atPeriodEnd: false` (the previous,
 * only behavior) cancels immediately. Either way, the DB write happens
 * only via the webhook (customer.subscription.updated for scheduled,
 * customer.subscription.deleted for immediate) — this function never
 * touches Mongo, keeping Stripe the single write path.
 */
const cancelStripeSubscription = async (subscriptionId, { atPeriodEnd = false } = {}) => {

   if (!subscriptionId) {
      throw new Error('Subscription ID required');
   }

   const subscription = await stripe.subscriptions.retrieve(subscriptionId);

   if (!subscription) {
      throw new Error('Subscription not found');
   }

   if (atPeriodEnd) {
      return await stripe.subscriptions.update(subscriptionId, {
         cancel_at_period_end: true
      });
   }

   return await stripe.subscriptions.cancel(subscriptionId);

};

/**
 * =====================================
 * ↩️ RESUME SUBSCRIPTION (undo a scheduled cancel_at_period_end)
 * =====================================
 * Only valid while the subscription is still active and hasn't actually
 * ended yet — Stripe will reject this once the period has elapsed and
 * the subscription is truly canceled, at which point the user needs a
 * fresh checkout instead.
 */
const resumeStripeSubscription = async (subscriptionId) => {

   if (!subscriptionId) {
      throw new Error('Subscription ID required');
   }

   return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
   });

};

/**
 * =====================================
 * 🧾 CREATE BILLING PORTAL
 * =====================================
 */
const createBillingPortal = async (customerId) => {

   if (!customerId) {
      throw new Error('Customer ID required');
   }

   return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.CLIENT_URL
   });

};

module.exports = {
   createCheckoutSession,
   changeSubscriptionPlan,
   cancelStripeSubscription,
   resumeStripeSubscription,
   createBillingPortal
};