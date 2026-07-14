const User = require('../models/user.model');

/**
 * =====================================
 * 🔐 SET USER PLAN (checkout completed, renewal, or plan/status change)
 * =====================================
 * `userId` is only known for the very first checkout (session.metadata).
 * Every subsequent event (renewals, portal-driven changes, status
 * transitions) has no userId — we must look the user up by
 * stripeSubscriptionId or stripeCustomerId instead.
 *
 * `status` is now REQUIRED and must be Stripe's own subscription status
 * string (active/trialing/past_due/canceled/unpaid/paused/incomplete/
 * incomplete_expired) — see webhook.routes.js. We no longer hardcode
 * 'active' here; the caller passes whatever Stripe actually reports, so
 * the DB never claims a status Stripe didn't confirm.
 *
 * NOTE: retry-on-write-conflict is handled ONE LEVEL UP, by wrapping the
 * whole webhook transaction in utils/mongoTransaction.js's
 * withTransactionRetry(). Retrying an individual write inside an
 * already-conflicted transaction doesn't work (see that file's comment),
 * so this function stays a plain, transaction-scoped write.
 */
const setUserPlan = async (
   { userId, stripeCustomerId, stripeSubscriptionId },
   { plan, billingInterval, stripePriceId, status, expiresAt },
   { session } = {}
) => {

   if (!status) {
      throw new Error('setUserPlan: status is required (pass Stripe\'s actual subscription status)');
   }

   const expiry =
      expiresAt instanceof Date && !isNaN(expiresAt)
         ? expiresAt
         : null;

   const queryOptions = session ? { session } : {};

   const update = {
      'subscription.plan': plan,
      'subscription.billingInterval': billingInterval,
      'subscription.status': status,
      'subscription.stripeCustomerId': stripeCustomerId,
      'subscription.stripeSubscriptionId': stripeSubscriptionId,
      'subscription.stripePriceId': stripePriceId,
      'subscription.expiresAt': expiry
   };

   if (userId) {
      const result = await User.findByIdAndUpdate(userId, update, queryOptions);
      if (result) return result;
      // Fall through if userId somehow didn't match (shouldn't happen,
      // but don't silently drop the event) — try the other keys below.
   }

   if (stripeSubscriptionId) {
      const result = await User.findOneAndUpdate(
         { 'subscription.stripeSubscriptionId': stripeSubscriptionId },
         update,
         queryOptions
      );
      if (result) return result;
   }

   // Fall back to customer ID (covers the very first
   // customer.subscription.updated firing before the DB has the
   // subscription ID saved yet, e.g. race with checkout.session.completed).
   if (stripeCustomerId) {
      const result = await User.findOneAndUpdate(
         { 'subscription.stripeCustomerId': stripeCustomerId },
         update,
         queryOptions
      );
      if (result) return result;
   }

   throw new Error(
      `setUserPlan: could not resolve a user via userId/subscriptionId/customerId ` +
      `(sub=${stripeSubscriptionId}, cust=${stripeCustomerId})`
   );
};

/**
 * =====================================
 * ⏸ PAYMENT FAILED -> past_due or unpaid (NOT an immediate downgrade)
 * =====================================
 * Stripe retries failed payments over several days (Smart Retries)
 * before giving up. We just mirror whatever status Stripe reports on
 * the subscription at the time of the failed invoice — usually
 * 'past_due', but can be 'unpaid' depending on your Dashboard's
 * subscription settings. Access is only actually pulled by
 * customer.subscription.deleted (see downgradeToFree) or by expiresAt
 * lapsing.
 */
const markPastDue = async (stripeSubscriptionId, status, { session } = {}) => {

   const queryOptions = session ? { session } : {};

   await User.findOneAndUpdate(
      { 'subscription.stripeSubscriptionId': stripeSubscriptionId },
      { 'subscription.status': status || 'past_due' },
      queryOptions
   );
};

/**
 * =====================================
 * 🚫 DOWNGRADE TO FREE (subscription cancelled/deleted, immediate)
 * =====================================
 */
const downgradeToFree = async (stripeSubscriptionId, { session } = {}) => {

   const queryOptions = session ? { session } : {};

   // NOTE: stripeCustomerId is intentionally kept. The Stripe *customer*
   // object (saved card, billing history) is separate from the
   // *subscription* that just ended — wiping it would force a brand new
   // Stripe customer (and re-entering a card) if this person resubscribes.
   await User.findOneAndUpdate(
      { 'subscription.stripeSubscriptionId': stripeSubscriptionId },
      {
         'subscription.plan': 'free',
         'subscription.billingInterval': null,
         'subscription.status': 'canceled',
         'subscription.stripeSubscriptionId': null,
         'subscription.stripePriceId': null,
         'subscription.expiresAt': null
      },
      queryOptions
   );
};

/**
 * =====================================
 * 👤 CLEAR STRIPE CUSTOMER (customer.deleted from Stripe's side)
 * =====================================
 * Rare (usually only via GDPR erasure tooling or manual Dashboard
 * deletion), but if it happens and we don't handle it, the sparse
 * unique index on subscription.stripeCustomerId will block this user
 * from ever getting a new Stripe customer created for them.
 */
const clearStripeCustomer = async (stripeCustomerId, { session } = {}) => {

   const queryOptions = session ? { session } : {};

   await User.findOneAndUpdate(
      { 'subscription.stripeCustomerId': stripeCustomerId },
      {
         'subscription.plan': 'free',
         'subscription.billingInterval': null,
         'subscription.status': 'canceled',
         'subscription.stripeCustomerId': null,
         'subscription.stripeSubscriptionId': null,
         'subscription.stripePriceId': null,
         'subscription.expiresAt': null
      },
      queryOptions
   );
};

module.exports = {
   setUserPlan,
   markPastDue,
   downgradeToFree,
   clearStripeCustomer
};
