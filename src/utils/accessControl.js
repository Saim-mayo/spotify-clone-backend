const AppError = require('../utils/appError');
const { MIN_PAID_LEVEL, getPlans } = require('../config/plans');
// NOTE: getPlans() is called fresh wherever plan features/levels are
// looked up below, rather than destructuring PLANS once here — PLANS is
// a getter over live Stripe-synced cache data, so grabbing it at require
// time would freeze a stale snapshot from server boot. Levels are also
// derived (see planSync.service.js), not a static map, since plan keys
// aren't a fixed enum anymore.

/**
 * =====================================
 * 🎯 CENTRAL ACCESS CONTROL SYSTEM
 * =====================================
 * WHY:
 * - single source of truth for all permissions
 * - replaces scattered middleware logic
 * - scalable SaaS design (Spotify-level)
 */

/**
 * Is this subscription currently entitled to its plan's benefits?
 * (active status AND not past its expiry — a `status: active` row can
 * still be stale for a few seconds/minutes right up until the next
 * webhook confirms renewal, so we always double check expiresAt too.)
 */
// 'trialing' is entitled too — a customer mid-trial should get the
// plan's benefits, not be treated as free. Every other non-'active'
// Stripe status (past_due, unpaid, paused, canceled, incomplete,
// incomplete_expired) is NOT entitled: access is pulled immediately on
// payment failure signals rather than waiting for the grace period to
// fully lapse, since Stripe already handles retry timing on its side.
const ENTITLED_STATUSES = ['active', 'trialing'];

const isEntitled = (sub) => {
   if (!sub) return false;
   if (!ENTITLED_STATUSES.includes(sub.status)) return false;
   if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
   return true;
};

/**
 * Effective plan level right now — 0 (free) if not entitled,
 * even if `plan` still says "pro" because the row hasn't been
 * downgraded yet by a webhook.
 */
const getEffectiveLevel = (user) => {

   const plans = getPlans();
   const freeLevel = plans.free.level;

   const sub = user?.subscription;
   if (!sub || sub.plan === 'free') return freeLevel;
   if (!isEntitled(sub)) return freeLevel;

   const plan = plans[sub.plan];

   // Unknown/removed plan, or a brand-new plan whose level hasn't been
   // derived yet (no active price synced): fail safe to free rather than
   // granting access we can't confirm the tier for.
   return plan?.level ?? freeLevel;
};

/**
 * 🔒 REQUIRE AT LEAST THIS TIER
 * e.g. requirePlan(user, 'pro') passes for pro and max, fails for basic/free.
 */
const requirePlan = (user, minimumPlanKey) => {

   if (!user) {
      throw new AppError('Unauthorized', 401);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const targetPlan = getPlans()[minimumPlanKey];

   if (!targetPlan || targetPlan.level == null) {
      throw new AppError(`Unknown plan: ${minimumPlanKey}`, 500);
   }

   const required = targetPlan.level;
   const effective = getEffectiveLevel(user);

   if (effective < required) {
      throw new AppError(
         `This feature requires the ${minimumPlanKey} plan or higher`,
         403
      );
   }

   return true;
};

/**
 * 🎧 CHECK: CAN PLAY SONG
 * All paid tiers currently get unlimited plays; free tier is limited
 * elsewhere (usage.middleware.js daily counter).
 */
const canPlaySong = (user) => {

   if (!user) {
      throw new AppError('Unauthorized', 401);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const effective = getEffectiveLevel(user);

   if (effective >= MIN_PAID_LEVEL) {
      return { allowed: true, unlimited: true };
   }

   return { allowed: true, unlimited: false };
};

/**
 * ⬇ CAN DOWNLOAD SONG (Pro and Max only — see config/plans.js features)
 */
/**
 * 🎛 CENTRAL FEATURE LOOKUP — single source every checker/route/frontend-flag uses
 */
const getPlanFeatures = (user) => {

   const plans = getPlans();
   const sub = user?.subscription;

   // Not entitled (or on free already) -> free features. Otherwise use
   // the plan key stored on the user directly rather than reverse-
   // searching by numeric level — plan keys aren't a fixed enum anymore,
   // so there's no static map to search, and the user's own subscription
   // record already says exactly which plan they're on.
   if (!sub || sub.plan === 'free' || !isEntitled(sub)) {
      return plans.free.features;
   }

   return plans[sub.plan]?.features || plans.free.features;
};

const canDownloadSong = (user) => {

   if (!user) {
      throw new AppError('Unauthorized', 401);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   const features = getPlanFeatures(user);

   if (!features.canDownload) {
      throw new AppError('Downloads require the Pro plan or higher', 403);
   }

   return true;
};

/**
 * 🎤 CAN UPLOAD SONG (ARTIST ONLY — unrelated to billing tier)
 */
const canUpload = (user) => {

   if (!user) {
      throw new AppError('Unauthorized', 401);
   }

   if (user.isBanned) {
      throw new AppError('Account banned', 403);
   }

   if (user.role !== 'artist') {
      throw new AppError('Only artists allowed', 403);
   }

   if (user.artistVerification?.status !== 'approved') {
      throw new AppError('Artist not approved', 403);
   }

   return true;
};

/**
 * 💿 CAN CREATE CONTENT
 */
const canCreateContent = (user) => {

   if (!user) {
      throw new AppError('Unauthorized', 401);
   }

   if (user.role !== 'artist') {
      throw new AppError('Artist access required', 403);
   }

   if (user.artistVerification?.status !== 'approved') {
      throw new AppError('Artist not verified', 403);
   }

   return true;
};

module.exports = {
   isEntitled,
   getEffectiveLevel,
   getPlanFeatures,
   requirePlan,
   canPlaySong,
   canDownloadSong,
   canUpload,
   canCreateContent
};
