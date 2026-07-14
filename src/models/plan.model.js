const mongoose = require('mongoose');

/**
 * =====================================
 * 💎 PLAN MODEL (STRIPE-SYNCED CATALOG)
 * =====================================
 * WHY THIS EXISTS:
 * - Previously every Stripe Price ID lived in `.env`. Changing a price in
 *   the Stripe Dashboard meant creating a new Price object (Stripe prices
 *   are immutable on amount), copying the new ID into `.env`, and
 *   redeploying the server. That doesn't scale past a handful of plans
 *   and turns a pricing change into an engineering task.
 * - This collection is a CACHE of Stripe's product/price catalog, kept in
 *   sync by webhook events (`price.created`, `price.updated`,
 *   `product.updated`, `price.deleted`) — see planSync.service.js.
 * - Stripe remains the source of truth for billing. Mongo just mirrors it
 *   so the app can resolve planKey/interval <-> priceId without reading
 *   `process.env` or making a live Stripe API call on every checkout.
 *
 * IMPORTANT:
 * - `planKey` is OUR internal identifier, used in URLs/API payloads. It's
 *   derived automatically from the Stripe Product — `metadata.planKey` if
 *   set, otherwise a slug of the Product name — there is no fixed
 *   free/basic/pro/max enum anywhere in this codebase anymore. See
 *   resolvePlanKey() in planSync.service.js.
 * - `features` (dailyPlayLimit/canDownload/maxDownloads/adFree) are read
 *   straight off the Stripe Product's metadata too. A brand-new plan's
 *   entire feature set is defined in the Stripe Dashboard, not in a JS
 *   file — see parseFeatureMetadata() in planSync.service.js.
 * - `level` is likewise derived, not hand-typed — see the field comment
 *   below and recomputePlanLevels() in planSync.service.js.
 * - Old/archived prices are NOT deleted from this collection when a new
 *   price replaces them — they're marked `active: false` and kept so
 *   existing subscribers still billing on that price ID continue to
 *   resolve correctly. Only remove a price document once nobody is on it.
 */

const priceSchema = new mongoose.Schema(
   {
      stripePriceId: {
         type: String,
         required: true
      },

      interval: {
         type: String,
         enum: ['monthly', 'yearly'],
         required: true
      },

      amount: {
         // smallest currency unit, as Stripe returns it (e.g. cents)
         type: Number,
         required: true
      },

      currency: {
         type: String,
         required: true,
         lowercase: true
      },

      // false = archived/replaced price. Kept resolvable for existing
      // subscribers but never offered to new checkouts.
      active: {
         type: Boolean,
         default: true
      }
   },
   { _id: false }
);

const planSchema = new mongoose.Schema(
   {
      planKey: {
         type: String,
         required: true,
         unique: true,
         index: true,
         lowercase: true,
         trim: true
      },

      name: {
         type: String,
         required: true
      },

      // Ordering for upgrade/downgrade comparisons. Stripe has no concept
      // of tier ordering, so this is DERIVED, not hand-set: it's the rank
      // of this plan's cheapest active price among all plans, cheapest
      // first (see recomputePlanLevels() in planSync.service.js, which
      // recalculates every plan's level any time prices or products
      // change). null until the plan has at least one active price, since
      // there's nothing yet to rank it against.
      level: {
         type: Number,
         default: null
      },

      stripeProductId: {
         type: String,
         default: null,
         index: true
      },

      prices: {
         type: [priceSchema],
         default: []
      },

      features: {
         dailyPlayLimit: { type: Number, default: null }, // null = unlimited
         canDownload: { type: Boolean, default: false },
         maxDownloads: { type: Number, default: 0 }, // null = unlimited
         adFree: { type: Boolean, default: false }
      },

      // Soft-disable a plan (e.g. discontinued tier) without deleting
      // history for users still on it.
      isActive: {
         type: Boolean,
         default: true
      },

      // Free tier has no Stripe product/prices at all — flag it so sync
      // logic and resolvers skip Stripe lookups for it.
      isFree: {
         type: Boolean,
         default: false
      },

      lastSyncedAt: {
         type: Date,
         default: null
      }
   },
   { timestamps: true }
);

planSchema.index({ 'prices.stripePriceId': 1 });

module.exports = mongoose.model('Plan', planSchema);
