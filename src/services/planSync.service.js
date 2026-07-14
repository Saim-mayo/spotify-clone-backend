const stripe = require('../config/stripe');
const Plan = require('../models/plan.model');
const { refreshPlanCache } = require('./planCache.service');

/**
 * =====================================
 * 🔄 STRIPE -> MONGO PLAN SYNC
 * =====================================
 * WHY:
 * - This is what lets a client/business owner add, remove, rename, or
 *   reprice a plan entirely from the Stripe Dashboard, with zero deploys
 *   and zero lines of code touched.
 * - There is NO pre-seeded list of plans anywhere in this codebase.
 *   `product.created` / `product.updated` webhook events are what create
 *   and update `Plan` documents. Creating a Stripe Product IS creating a
 *   plan tier.
 * - Stripe Prices are immutable on amount — "changing a price" in Stripe
 *   always means: archive the old Price, create a new one. So price
 *   syncing is "mirror whatever Prices currently exist on this Product
 *   into Mongo, marking ones Stripe no longer returns as active as
 *   inactive here too."
 *
 * HOW A PLAN IS IDENTIFIED:
 * - `planKey` (our internal identifier, used in API payloads/URLs) comes
 *   from the Product, in this order:
 *     1. product.metadata.planKey, if set (lets you pick a nicer key than
 *        the auto-slug, e.g. "pro" instead of "pro-plan-v2")
 *     2. a slug of the Product name otherwise
 *   There is no enum to update anywhere else in the app when a new
 *   product shows up — see resolvePlanKey() below.
 *
 * HOW FEATURES ARE IDENTIFIED:
 * - `features` (dailyPlayLimit/canDownload/maxDownloads/adFree) are read
 *   from the Product's metadata directly — see parseFeatureMetadata().
 *   A brand-new plan's entire feature set is therefore defined in the
 *   Stripe Dashboard, never in a JS file.
 *
 * HOW LEVEL (upgrade/downgrade rank) IS IDENTIFIED:
 * - Stripe has no concept of tier ordering, so instead of hand-typing it
 *   we derive it: sort every non-free Plan by its cheapest currently
 *   active price, ascending. Higher price = higher level. See
 *   recomputePlanLevels() below, called after every price/product sync
 *   since either can change the ordering.
 */

// ==========================================
// planKey resolution
// ==========================================

/**
 * Turn a Product name into a URL/API-safe slug, e.g. "Pro Plan!" -> "pro-plan".
 */
function slugify(value) {
   return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
}

/**
 * Resolve the planKey for a Stripe Product. Prefers an explicit
 * metadata.planKey (handy if you want a shorter/nicer key than the name
 * would slugify to); falls back to a slug of the product name; falls
 * back to the raw product ID if the name doesn't slugify to anything
 * usable (e.g. a name that's pure emoji/punctuation).
 */
function resolvePlanKey(product) {

   if (product.metadata && product.metadata.planKey) {
      return product.metadata.planKey.toLowerCase().trim();
   }

   const slug = slugify(product.name);

   return slug || product.id.toLowerCase();
}

// ==========================================
// feature resolution (from Product metadata)
// ==========================================

function parseNullableInt(raw, fallback) {

   if (raw === undefined || raw === null || raw === '') return fallback;

   const normalized = String(raw).toLowerCase().trim();

   if (normalized === 'null' || normalized === 'unlimited') return null;

   const parsed = parseInt(normalized, 10);

   return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(raw, fallback) {

   if (raw === undefined || raw === null || raw === '') return fallback;

   return ['true', '1', 'yes'].includes(String(raw).toLowerCase().trim());
}

/**
 * Read plan features straight off Stripe Product metadata:
 *   metadata.dailyPlayLimit  -> number, or "null"/"unlimited" for none
 *   metadata.canDownload     -> "true"/"false"
 *   metadata.maxDownloads    -> number, or "null"/"unlimited" for none
 *   metadata.adFree          -> "true"/"false"
 * Anything unset falls back to the conservative (least-privileged)
 * default, so a plan someone forgot to tag doesn't accidentally grant
 * unlimited downloads.
 */
function parseFeatureMetadata(metadata = {}) {
   return {
      dailyPlayLimit: parseNullableInt(metadata.dailyPlayLimit, null),
      canDownload: parseBool(metadata.canDownload, false),
      maxDownloads: parseNullableInt(metadata.maxDownloads, 0),
      adFree: parseBool(metadata.adFree, false)
   };
}

function resolveInterval(price) {

   if (!price.recurring) return null;

   // We only support monthly/yearly billing intervals in this app.
   if (price.recurring.interval === 'month' && price.recurring.interval_count === 1) {
      return 'monthly';
   }

   if (price.recurring.interval === 'year' && price.recurring.interval_count === 1) {
      return 'yearly';
   }

   return null;
}

// ==========================================
// level derivation
// ==========================================

function cheapestActivePriceAmount(plan) {

   const activeAmounts = (plan.prices || [])
      .filter((p) => p.active)
      .map((p) => p.amount);

   if (activeAmounts.length === 0) return null;

   return Math.min(...activeAmounts);
}

/**
 * Recompute `level` for every non-free plan: rank by cheapest active
 * price, ascending (1 = cheapest paid plan, 2 = next, ...). Plans with no
 * active price yet (brand new product, prices not synced/created yet)
 * get `level: null` — there's nothing to rank them against.
 *
 * NOTE: this compares raw `amount` across plans regardless of currency.
 * If you sell the same tier in multiple currencies, tag one Price per
 * plan as the "reference" price (e.g. your home currency) and keep the
 * rest consistent with it — mixing currencies with very different unit
 * values (e.g. JPY vs USD) will rank plans incorrectly.
 *
 * Called after every price sync and every product sync, since either
 * can change relative ordering (a new cheaper plan, a price change that
 * leapfrogs another tier, a plan getting its first price, etc).
 */
async function recomputePlanLevels() {

   const plans = await Plan.find({ isFree: false });

   const ranked = [];
   const unranked = [];

   for (const plan of plans) {

      const cheapest = cheapestActivePriceAmount(plan);

      if (cheapest === null) {
         unranked.push(plan);
      } else {
         ranked.push({ plan, cheapest });
      }
   }

   ranked.sort((a, b) => a.cheapest - b.cheapest);

   let level = 1;

   for (const { plan } of ranked) {

      if (plan.level !== level) {
         plan.level = level;
         await plan.save();
      }

      level += 1;
   }

   for (const plan of unranked) {

      if (plan.level !== null) {
         plan.level = null;
         await plan.save();
      }
   }
}

// ==========================================
// product sync (creates/updates the Plan document itself)
// ==========================================

/**
 * Create or update the Plan document for a Stripe Product. This is what
 * a `product.created`/`product.updated` webhook (or the backfill script)
 * calls — there's no separate "register a new plan tier" step, this IS
 * that step.
 *
 * Idempotent: safe to call repeatedly for the same product.
 */
async function upsertProductFromStripe(stripeProductId) {

   const product = await stripe.products.retrieve(stripeProductId);

   const planKey = resolvePlanKey(product);
   const features = parseFeatureMetadata(product.metadata);

   // ATOMIC upsert on the (unique) stripeProductId — this is what fixes
   // the duplicate-key race: Stripe commonly fires product.created and
   // price.created for the same product within milliseconds, and
   // syncPriceFromStripe() also calls this function when a price arrives
   // before its product does. The old code did a plain findOne() then
   // `new Plan(...).save()`, which is a check-then-act race: two
   // concurrent webhook deliveries could both see "doesn't exist yet"
   // and both try to insert, crashing on the unique planKey index.
   // findOneAndUpdate + upsert is a single atomic Mongo operation, so
   // only one of two concurrent calls actually inserts; the other just
   // updates the row the first one created.
   let plan = await Plan.findOneAndUpdate(
      { stripeProductId: product.id },
      {
         $setOnInsert: {
            stripeProductId: product.id,
            planKey,
            prices: [],
            isFree: false
         }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
   );

   const wasJustCreated = plan.name === undefined;

   if (wasJustCreated) {
      console.log(`＋ Plan sync: created "${plan.planKey}" for product ${product.id}`);
   }

   plan.name = product.name;
   plan.features = features;
   plan.isActive = product.active;

   // Re-resolve planKey too, so renaming a Product in Stripe (or
   // changing its metadata.planKey) is reflected without a code
   // change — but only if it doesn't collide with a DIFFERENT plan, and
   // only if this wasn't the insert branch above (which already set the
   // right key).
   if (!wasJustCreated && planKey !== plan.planKey) {

      const collision = await Plan.findOne({
         planKey,
         _id: { $ne: plan._id }
      });

      if (!collision) {
         plan.planKey = planKey;
      } else {
         console.warn(
            `⚠️ Plan sync: product ${product.id} resolved to planKey "${planKey}" ` +
            `which is already used by another plan — keeping existing key "${plan.planKey}"`
         );
      }
   }

   plan.lastSyncedAt = new Date();

   try {
      await plan.save();
   } catch (err) {
      // Extremely rare residual race: the atomic upsert above prevents
      // duplicate DOCUMENTS, but two concurrent calls could still both
      // resolve to the SAME new planKey collision check simultaneously.
      // If we still hit the unique index here, suffix and retry once
      // rather than crashing the webhook.
      if (err.code === 11000) {
         plan.planKey = `${plan.planKey}-${product.id.slice(-8)}`;
         await plan.save();
      } else {
         throw err;
      }
   }

   await recomputePlanLevels();
   await refreshPlanCache();

   console.log(`✅ Plan sync: product ${product.id} -> planKey "${plan.planKey}"`);

   return plan;
}

/**
 * Handle `product.deleted` — Stripe fires this on hard delete (distinct
 * from archiving, which is `product.updated` with active:false and is
 * already handled above). We don't delete the Mongo doc (existing
 * subscribers on prices under this product must keep resolving), we
 * just mark it inactive so it drops out of getPlans()/checkout.
 */
async function deactivateProduct(stripeProductId) {

   const plan = await Plan.findOneAndUpdate(
      { stripeProductId },
      { isActive: false, lastSyncedAt: new Date() },
      { new: true }
   );

   if (plan) {
      await refreshPlanCache();
      console.log(`🗑️ Plan sync: product ${stripeProductId} deleted in Stripe -> "${plan.planKey}" deactivated`);
   }

   return plan;
}

/**
 * Handle `price.deleted`. Prices are usually archived, not deleted, but
 * a hard delete can happen. Mark it inactive rather than splicing it
 * out — cheaper and consistent with how archived prices are handled.
 */
async function deactivatePrice(stripePriceId) {

   const plan = await Plan.findOneAndUpdate(
      { 'prices.stripePriceId': stripePriceId },
      { $set: { 'prices.$.active': false, lastSyncedAt: new Date() } },
      { new: true }
   );

   if (plan) {
      await recomputePlanLevels();
      await refreshPlanCache();
      console.log(`🗑️ Plan sync: price ${stripePriceId} deleted in Stripe -> marked inactive on "${plan.planKey}"`);
   }

   return plan;
}

// ==========================================
// price sync
// ==========================================

/**
 * Sync a single Stripe Price into the matching Plan document's `prices`
 * array. Called from the webhook on `price.created` / `price.updated`,
 * and from the backfill script/admin resync.
 *
 * If the Plan document doesn't exist yet (e.g. `price.created` happened
 * to arrive before `product.created`, or the product was created outside
 * this app's lifetime and never backfilled), this creates it on the fly
 * by syncing the product first — no manual seeding step required.
 */
async function syncPriceFromStripe(stripePriceId) {

   const price = await stripe.prices.retrieve(stripePriceId, {
      expand: ['product']
   });

   const interval = resolveInterval(price);

   if (!interval) {
      console.warn(
         `⚠️ Plan sync: price ${stripePriceId} is not a monthly/yearly recurring price, skipping`
      );
      return null;
   }

   const stripeProductId =
      typeof price.product === 'object' ? price.product.id : price.product;

   let plan = await Plan.findOne({ stripeProductId });

   if (!plan) {
      // Product hasn't been synced yet — sync it now rather than warning
      // and dropping the price on the floor.
      plan = await upsertProductFromStripe(stripeProductId);
   }

   const priceEntry = {
      stripePriceId: price.id,
      interval,
      amount: price.unit_amount,
      currency: price.currency,
      active: price.active
   };

   const existingIndex = plan.prices.findIndex(
      (p) => p.stripePriceId === price.id
   );

   if (existingIndex >= 0) {
      plan.prices[existingIndex] = priceEntry;
   } else {
      plan.prices.push(priceEntry);
   }

   // If this price is active and replaces an older active price for the
   // SAME interval, archive the older one here too — mirrors what "create
   // a new price, archive the old one" looks like in Stripe.
   if (priceEntry.active) {
      for (const p of plan.prices) {
         if (
            p.stripePriceId !== priceEntry.stripePriceId &&
            p.interval === interval &&
            p.active
         ) {
            p.active = false;
         }
      }
   }

   plan.lastSyncedAt = new Date();

   await plan.save();

   await recomputePlanLevels();
   await refreshPlanCache();

   console.log(`✅ Plan sync: ${plan.planKey}/${interval} -> ${price.id} (active: ${price.active})`);

   return plan;
}

/**
 * Full backfill: given a Stripe Product ID, pull ALL its prices and sync
 * them. Used by the generic backfill (syncAllProductsFromStripe), and by
 * the admin manual-resync endpoint. Safe to run repeatedly (idempotent).
 */
async function syncAllPricesForProduct(stripeProductId) {

   const prices = await stripe.prices.list({
      product: stripeProductId,
      limit: 100,
      expand: ['data.product']
   });

   const results = [];

   for (const price of prices.data) {
      const result = await syncPriceFromStripe(price.id);
      if (result) results.push(price.id);
   }

   return results;
}

// ==========================================
// generic full-catalog backfill
// ==========================================

/**
 * Pull EVERY product Stripe knows about and sync it (and its prices)
 * into Mongo. No product-ID list anywhere — add a product in Stripe,
 * run this once (or just wait for the webhook), it's in Mongo.
 * Used by scripts/syncPlans.js and the admin `/plans/resync-all` route.
 */
async function syncAllProductsFromStripe() {

   const results = [];

   let startingAfter;
   let hasMore = true;

   while (hasMore) {

      const page = await stripe.products.list({
         limit: 100,
         starting_after: startingAfter
      });

      for (const product of page.data) {

         const plan = await upsertProductFromStripe(product.id);
         const syncedPriceIds = await syncAllPricesForProduct(product.id);

         results.push({
            stripeProductId: product.id,
            planKey: plan.planKey,
            syncedPriceIds
         });
      }

      hasMore = page.has_more;
      startingAfter = page.data.length
         ? page.data[page.data.length - 1].id
         : undefined;
   }

   return results;
}

module.exports = {
   upsertProductFromStripe,
   syncPriceFromStripe,
   syncAllPricesForProduct,
   syncAllProductsFromStripe,
   deactivateProduct,
   deactivatePrice,
   recomputePlanLevels,
   resolvePlanKey,
   resolveInterval,
   parseFeatureMetadata
};
