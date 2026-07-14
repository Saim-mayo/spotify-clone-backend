const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');

const {
   paymentLimiter
} = require('../middlewares/rateLimit.middleware');

const {
   listPlans,
   createPaymentSession,
   changePlan,
   getSubscriptionStatus,
   getPaymentHistory,
   openBillingPortal,
   cancelSubscription,
   resumeSubscription
} = require('../controllers/payment.controller');

// =====================
// LIST PLANS (public)
// =====================

router.get(
   '/plans',
   listPlans
);

// =====================
// CHECKOUT
// =====================

router.post(
   '/checkout',
   paymentLimiter,
   authMiddleware,
   createPaymentSession
);

// =====================
// CHANGE PLAN (upgrade/downgrade)
// =====================

router.post(
   '/change-plan',
   paymentLimiter,
   authMiddleware,
   changePlan
);

// =====================
// SUBSCRIPTION STATUS
// =====================

router.get(
   '/subscription/status',
   authMiddleware,
   getSubscriptionStatus
);

// =====================
// PAYMENT HISTORY
// =====================

router.get(
   '/history',
   authMiddleware,
   getPaymentHistory
);

// =====================
// STRIPE BILLING PORTAL
// =====================

router.post(
   '/billing-portal',
   authMiddleware,
   openBillingPortal
);

// =====================
// CANCEL SUBSCRIPTION
// =====================

router.delete(
   '/subscription',
   paymentLimiter,
   authMiddleware,
   cancelSubscription
);

// =====================
// RESUME (undo scheduled cancel_at_period_end)
// =====================

router.post(
   '/subscription/resume',
   paymentLimiter,
   authMiddleware,
   resumeSubscription
);

module.exports = router;
