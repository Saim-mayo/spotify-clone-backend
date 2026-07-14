/**
 * =====================================
 * 💎 PLAN CATALOG (RESOLVER LAYER)
 * =====================================
 * WHAT CHANGED:
 * - Stripe Price IDs no longer live in `.env`. They live in the `Plan`
 *   collection in Mongo (see models/plan.model.js), kept in sync with
 *   Stripe via webhooks (see services/planSync.service.js) and cached in
 *   memory for fast lookups (see services/planCache.service.js).
 * - There is no fixed enum of plan keys ("free"/"basic"/"pro"/"max")
 *   anywhere in this file or the codebase. `product.created` /
 *   `product.updated` webhooks auto-create/update the Plan document for
 *   whatever Products exist in Stripe, `name`/`features` come from
 *   Product metadata, and `level` (upgrade/downgrade rank) is derived by
 *   sorting plans by their cheapest active price — see
 *   planSync.service.js for all three. A brand-new plan tier requires
 *   zero code changes: create the Product in Stripe, done.
 * - The checkout/change-plan endpoints still only ever accept a
 *   `planKey` + `interval` from the client, never a raw Stripe price ID
 *   — this file still resolves that server-side, same security model as
 *   before, just backed by Mongo/cache instead of env vars.
 *
 * SETUP STEPS IN STRIPE DASHBOARD (per plan):
 * 1. Create a Product (e.g. "Pro").
 *    - Optionally set metadata.planKey (otherwise one is slugified from
 *      the Product name).
 *    - Set metadata.dailyPlayLimit / canDownload / maxDownloads / adFree
 *      to define the plan's feature set (see parseFeatureMetadata() in
 *      planSync.service.js for the exact format).
 * 2. Add Prices to it (recurring, monthly and/or yearly).
 * 3. That's it — no env vars, no redeploy, no file in this repo to edit.
 *    The webhook handler picks up `product.created`, `product.updated`,
 *    `price.created`, and `price.updated` and syncs into Mongo within the
 *    same request that Stripe sends the event.
 *
 * FIRST-TIME SETUP / NEW ENVIRONMENT:
 * - Run `node src/scripts/syncPlans.js` once after setting up your Stripe
 *   account. It calls stripe.products.list() and syncs everything Stripe
 *   returns — no product-ID list to configure — so the cache isn't empty
 *   on first boot.
 */

const planCache = require('../services/planCache.service');

/**
 * The free tier isn't billed through Stripe, so it isn't ranked by the
 * price-based level derivation in planSync.service.js — it's always the
 * floor. Every paid plan's derived `level` starts at 1 and counts up from
 * there (cheapest first), so "level >= MIN_PAID_LEVEL" is the generic,
 * name-free way to ask "is this any paid plan at all".
 */
const MIN_PAID_LEVEL = 1;

/**
 * Static feature/business config for plans that AREN'T billed through
 * Stripe (i.e. the free tier — no product, no prices, nothing to sync).
 * Paid plans' features live on the Plan document in Mongo instead, since
 * those are seeded/managed there alongside the Stripe-synced pricing.
 */
const FREE_PLAN = {
   key: 'free',
   name: 'Free',
   level: 0,
   priceIds: {},
   features: {
      dailyPlayLimit: 10, // enforced in usage.middleware.js
      canDownload: false,
      maxDownloads: 0,
      adFree: false
   }
};

/**
 * Return the full plan catalog in the SAME SHAPE the rest of the app
 * (listPlans controller, etc.) already expects: an object keyed by
 * planKey, each with { key, name, level, priceIds, features }.
 * Reads from the in-memory cache — no DB hit on this call.
 */
function getPlans() {

   const plans = { free: FREE_PLAN };

   for (const plan of planCache.getAllPlans()) {

      // Archived/deleted Stripe Products must not show up in the public
      // catalog or be checkout-able — previously this loop returned
      // every plan in the cache regardless of isActive, so archiving a
      // product in the Dashboard didn't actually remove it from
      // /payment/plans or block new checkouts against it.
      if (!plan.isActive) continue;

      const priceIds = {};

      for (const price of plan.prices || []) {
         if (price.active) {
            priceIds[price.interval] = price.stripePriceId;
         }
      }

      plans[plan.planKey] = {
         key: plan.planKey,
         name: plan.name,
         level: plan.level,
         priceIds,
         features: plan.features
      };
   }

   return plans;
}

/**
 * Resolve a (planKey, interval) chosen by the client to a real,
 * server-trusted, currently-active Stripe price ID. Returns null if
 * invalid, unrecognized, or if that price has been archived.
 */
function resolvePriceId(planKey, interval) {

   if (planKey === 'free') return null;

   return planCache.resolvePriceId(planKey, interval);
}

/**
 * Resolve a Stripe price ID (from a webhook payload) back to plan info.
 * Returns null if it's not a price ID we recognize — webhook handler
 * should treat that as a hard error, not silently ignore it.
 *
 * Deliberately resolves archived prices too (see planCache.service.js) —
 * an existing subscriber on a price that was later archived must keep
 * resolving correctly on renewal.
 */
function resolvePlanFromPriceId(priceId) {

   const resolved = planCache.resolvePlanFromPriceId(priceId);

   if (!resolved) return null;

   return { planKey: resolved.planKey, interval: resolved.interval };
}

/**
 * Is switching from currentPlanKey to targetPlanKey a downgrade? Levels
 * are derived (see planSync.service.js), so this reads live plan data
 * rather than a static map. Only used to pick which message to show the
 * user (see payment.controller.js) — if either plan's level can't be
 * determined yet (e.g. a brand-new tier with no active price synced
 * yet), we default to "not a downgrade" rather than guessing.
 */
function isDowngrade(currentPlanKey, targetPlanKey) {

   const plans = getPlans();

   const current = plans[currentPlanKey];
   const target = plans[targetPlanKey];

   if (!current || !target || current.level == null || target.level == null) {
      return false;
   }

   return target.level < current.level;
}

module.exports = {
   MIN_PAID_LEVEL,
   get PLANS() {
      // Kept as a getter (not a plain object computed once at require
      // time) so callers doing `PLANS.pro` always see live cache data,
      // matching how the old env-var version behaved at require time —
      // except this one can actually change without a restart.
      return getPlans();
   },
   getPlans,
   resolvePriceId,
   resolvePlanFromPriceId,
   isDowngrade
};
