const asyncHandler = require('../utils/asyncHandler');

const Payment = require('../models/payment.model');
const User = require('../models/user.model');

const AppError = require('../utils/appError');

const { getPlans, resolvePriceId, isDowngrade } =
   require('../config/plans');
// NOTE: call getPlans() fresh at each use rather than destructuring PLANS
// once — PLANS is a getter over live cache data, so destructuring it here
// at require time would freeze a snapshot from server boot and never see
// later Stripe-synced price/plan changes.

const { isEntitled } = require('../utils/accessControl');

const {
   createCheckoutSession,
   changeSubscriptionPlan,
   cancelStripeSubscription,
   resumeStripeSubscription,
   createBillingPortal
} = require('../services/stripe.service');

// ===========================
// LIST PLANS (public — no price IDs or secrets, just display data)
// ===========================
const listPlans = asyncHandler(async (req, res) => {

   const publicPlans = Object.values(getPlans()).map((p) => ({
      key: p.key,
      name: p.name,
      level: p.level,
      features: p.features
   }));

   return res.status(200).json({
      success: true,
      plans: publicPlans
   });
});

// ===========================
// CREATE CHECKOUT SESSION
// ===========================
const createPaymentSession = asyncHandler(async (req, res) => {

   const { planKey, interval } = req.body;

   if (!planKey || !getPlans()[planKey]) {
      throw new AppError('Invalid plan', 400);
   }

   if (!['monthly', 'yearly'].includes(interval)) {
      throw new AppError('Invalid billing interval', 400);
   }

   const user = await User.findById(req.user.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   // Using isEntitled() instead of a hardcoded status === 'active' check
   // so this also catches 'trialing' — someone mid-trial shouldn't be
   // able to open a second Checkout Session for a different plan; they
   // should use change-plan.
   if (user.subscription?.plan !== 'free' && isEntitled(user.subscription)) {
      throw new AppError(
         'You already have an active subscription. Use change-plan to switch tiers.',
         400
      );
   }

   const session = await createCheckoutSession(user, planKey, interval);

   return res.status(200).json({
      success: true,
      url: session.url
   });
});

// ===========================
// CHANGE PLAN (upgrade or downgrade an existing subscription)
// ===========================
const changePlan = asyncHandler(async (req, res) => {

   const { planKey, interval } = req.body;

   if (!planKey || !getPlans()[planKey]) {
      throw new AppError('Invalid plan', 400);
   }

   if (!['monthly', 'yearly'].includes(interval)) {
      throw new AppError('Invalid billing interval', 400);
   }

   const user = await User.findById(req.user.userId);

   if (!user) {
      throw new AppError('User not found', 404);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const subscriptionId = user.subscription?.stripeSubscriptionId;

   if (!subscriptionId || !isEntitled(user.subscription)) {
      throw new AppError(
         'No active subscription to change — use checkout instead.',
         400
      );
   }

   const newPriceId = resolvePriceId(planKey, interval);

   if (!newPriceId) {
      throw new AppError('Invalid plan or billing interval', 400);
   }

   const direction = isDowngrade(user.subscription.plan, planKey)
      ? 'downgrade'
      : 'upgrade';

   // The Stripe update triggers customer.subscription.updated, which is
   // what actually writes the new plan to the DB — this endpoint just
   // kicks it off and reports back what will happen.
   const result = await changeSubscriptionPlan(
      subscriptionId,
      newPriceId
   );

   if (!result.changed) {
      throw new AppError(
         `You are already subscribed to the ${planKey} (${interval}) plan.`,
         409
      );
   }

   return res.status(200).json({
      success: true,
      direction,
      message:
         direction === 'upgrade'
            ? 'Plan upgraded. You were charged a prorated amount immediately.'
            : 'Plan downgraded. A prorated credit was applied to your account.'
   });
});
   // ===========================
   // GET SUBSCRIPTION STATUS
   // ===========================
   const getSubscriptionStatus = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId)
         .select('subscription isBanned');

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      return res.status(200).json({
         success: true,
         subscription: user.subscription
      });
   });

   // ===========================
   // PAYMENT HISTORY
   // ===========================
   const getPaymentHistory = asyncHandler(async (req, res) => {

      const payments = await Payment.find({
         userId: req.user.userId
      }).sort({
         createdAt: -1
      });

      return res.status(200).json({
         success: true,
         payments
      });
   });

   // ===========================
   // OPEN BILLING PORTAL
   // ===========================
   const openBillingPortal = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      let customerId = user.subscription?.stripeCustomerId;

      if (!customerId) {

         const latestPayment = await Payment.findOne({
            userId: req.user.userId
         }).sort({
            createdAt: -1
         });

         customerId = latestPayment?.stripeCustomerId;
      }

      if (!customerId) {
         throw new AppError('No Stripe customer found', 400);
      }

      const session = await createBillingPortal(customerId);

      return res.status(200).json({
         success: true,
         url: session.url
      });
   });

   // ===========================
   // CANCEL SUBSCRIPTION
   // ===========================
   // Body: { atPeriodEnd?: boolean } — defaults to false (immediate
   // cancel, matching the previous behavior) for backward compatibility.
   // Pass atPeriodEnd: true for the far more common "cancel my plan but
   // let me keep access until it runs out" UX.
   const cancelSubscription = asyncHandler(async (req, res) => {

      const { atPeriodEnd = false } = req.body || {};

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      const subscriptionId = user.subscription?.stripeSubscriptionId;

      if (!subscriptionId) {
         throw new AppError('No active subscription found', 400);
      }

      // Either path writes to Stripe only. The webhook
      // (customer.subscription.updated for scheduled cancellation,
      // customer.subscription.deleted for immediate) is what actually
      // updates the DB — this endpoint keeps Stripe the single source
      // of truth rather than writing local state directly.
      await cancelStripeSubscription(subscriptionId, { atPeriodEnd });

      return res.status(200).json({
         success: true,
         message: atPeriodEnd
            ? 'Subscription will cancel at the end of the current billing period. Access continues until then.'
            : 'Subscription cancelled. Access has ended immediately.'
      });
   });

   // ===========================
   // RESUME SUBSCRIPTION (undo a scheduled cancel_at_period_end)
   // ===========================
   const resumeSubscription = asyncHandler(async (req, res) => {

      const user = await User.findById(req.user.userId);

      if (!user) {
         throw new AppError('User not found', 404);
      }

      if (user.isBanned) {
         throw new AppError('Account banned', 403);
      }

      const subscriptionId = user.subscription?.stripeSubscriptionId;

      if (!subscriptionId) {
         throw new AppError('No subscription to resume', 400);
      }

      await resumeStripeSubscription(subscriptionId);

      return res.status(200).json({
         success: true,
         message: 'Scheduled cancellation removed — your subscription will continue renewing.'
      });
   });

   module.exports = {
      listPlans,
      createPaymentSession,
      changePlan,
      getSubscriptionStatus,
      getPaymentHistory,
      openBillingPortal,
      cancelSubscription,
      resumeSubscription
   };


