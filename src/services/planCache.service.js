const Plan = require('../models/plan.model');

/**
 * =====================================
 * ⚡ PLAN CACHE (IN-MEMORY, DB-BACKED)
 * =====================================
 * WHY:
 * - Every checkout, plan-change, and webhook call needs to resolve
 *   planKey/interval <-> stripePriceId. Hitting Mongo for that on every
 *   request works, but there's no reason to pay a DB round trip for data
 *   that changes maybe a few times a month.
 * - This module holds the whole Plan catalog in memory, keyed for O(1)
 *   lookups both directions, and refreshes itself:
 *     1. once at process boot (`loadPlanCache`)
 *     2. any time planSync.service.js upserts a Plan document (it calls
 *        `refreshPlanCache` after writing)
 *     3. via the admin manual-resync endpoint, for out-of-band fixes
 *
 * This is a single-process in-memory cache. If you run this app on
 * multiple instances/pods, each one refreshes independently in response
 * to the SAME webhook event (Stripe fans the event out via your load
 * balancer to whichever instance owns that request) — so a resync on
 * one instance does not automatically inform its siblings. In practice
 * this is fine for a pricing catalog (each instance will catch the next
 * webhook itself, i.e. the whole `price.*` family of events, and this
 * data changes rarely), but if you need cross-instance consistency
 * immediately, swap this for a shared cache (Redis) using the same
 * get/set shape.
 */

let cache = {
   byPlanKey: new Map(),      // planKey -> plan doc (lean)
   byPriceId: new Map(),      // stripePriceId -> { planKey, interval, plan }
   loadedAt: null
};

function buildIndexes(plans) {

   const byPlanKey = new Map();
   const byPriceId = new Map();

   for (const plan of plans) {

      byPlanKey.set(plan.planKey, plan);

      for (const price of plan.prices || []) {

         if (!price.stripePriceId) continue;

         byPriceId.set(price.stripePriceId, {
            planKey: plan.planKey,
            interval: price.interval,
            priceId: price.stripePriceId,
            active: price.active,
            plan
         });
      }
   }

   return { byPlanKey, byPriceId };
}

/**
 * Load (or reload) the entire Plan catalog from Mongo into memory.
 * Call this once at server boot, before accepting traffic.
 */
async function loadPlanCache() {

   const plans = await Plan.find({}).lean();

   const { byPlanKey, byPriceId } = buildIndexes(plans);

   cache = {
      byPlanKey,
      byPriceId,
      loadedAt: new Date()
   };

   return cache;
}

/**
 * Alias for loadPlanCache — used after a sync write so the naming at the
 * call site reads clearly ("refresh after I just changed something").
 */
async function refreshPlanCache() {
   return loadPlanCache();
}

function getAllPlans() {
   return Array.from(cache.byPlanKey.values());
}

function getPlan(planKey) {
   return cache.byPlanKey.get(planKey) || null;
}

/**
 * Resolve a client-chosen (planKey, interval) to a real, active Stripe
 * price ID. Returns null if invalid OR if that price has been archived —
 * archived prices should not be offered on new checkouts.
 */
function resolvePriceId(planKey, interval) {

   const plan = cache.byPlanKey.get(planKey);
   // isActive false = the Product was archived/deleted in Stripe. Never
   // let a new checkout resolve to it, even if one of its prices still
   // shows active:true in our cache.
   if (!plan || !plan.isActive) return null;

   const price = (plan.prices || []).find(
      (p) => p.interval === interval && p.active
   );

   return price ? price.stripePriceId : null;
}

/**
 * Resolve a Stripe price ID (from a webhook payload) back to plan info.
 * Deliberately does NOT filter on `active` — a webhook must still be able
 * to resolve a legacy/archived price so existing subscribers on an old
 * price keep working after the price is replaced.
 */
function resolvePlanFromPriceId(priceId) {
   return cache.byPriceId.get(priceId) || null;
}

function getCacheMeta() {
   return {
      loadedAt: cache.loadedAt,
      planCount: cache.byPlanKey.size,
      priceCount: cache.byPriceId.size
   };
}

module.exports = {
   loadPlanCache,
   refreshPlanCache,
   getAllPlans,
   getPlan,
   resolvePriceId,
   resolvePlanFromPriceId,
   getCacheMeta
};
