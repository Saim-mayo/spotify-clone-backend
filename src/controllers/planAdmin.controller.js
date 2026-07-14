const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');

const {
   syncAllPricesForProduct,
   upsertProductFromStripe,
   syncAllProductsFromStripe
} = require('../services/planSync.service');
const { getAllPlans, getCacheMeta } = require('../services/planCache.service');

/**
 * =====================================
 * 💎 PLAN CATALOG — ADMIN CONTROLS
 * =====================================
 * These exist as a manual recovery/inspection path. Normal operation
 * needs NONE of these — webhooks (price.created/updated,
 * product.updated) keep Mongo and the in-memory cache in sync
 * automatically whenever the price is changed in the Stripe Dashboard.
 *
 * Use these when:
 * - a webhook delivery was missed (Stripe was down, endpoint was
 *   briefly unreachable, etc.) and you don't want to wait for the next
 *   unrelated event to happen to re-sync it
 * - debugging a mismatch between what Stripe shows and what the app is
 *   charging/displaying
 */

// ===========================
// GET CURRENT CACHED CATALOG (debug view)
// ===========================
const getPlanCacheStatus = asyncHandler(async (req, res) => {

   return res.status(200).json({
      success: true,
      meta: getCacheMeta(),
      plans: getAllPlans()
   });
});

// ===========================
// FORCE RESYNC ONE PRODUCT FROM STRIPE
// ===========================
const resyncProduct = asyncHandler(async (req, res) => {

   const { stripeProductId } = req.body;

   if (!stripeProductId) {
      throw new AppError('stripeProductId is required', 400);
   }

   const plan = await upsertProductFromStripe(stripeProductId);
   const syncedPriceIds = await syncAllPricesForProduct(stripeProductId);

   return res.status(200).json({
      success: true,
      message: `Resynced product ${stripeProductId}`,
      planKey: plan.planKey,
      syncedPriceIds
   });
});

// ===========================
// FORCE RESYNC ALL PRODUCTS
// ===========================
// Pulls every product Stripe currently knows about (stripe.products.list),
// not just ones already in Mongo — so this also picks up a brand-new
// plan tier created in Stripe that never got its webhook delivered,
// with no product-ID list to keep updated here.
const resyncAllProducts = asyncHandler(async (req, res) => {

   const results = await syncAllProductsFromStripe();

   return res.status(200).json({
      success: true,
      message: `Resynced ${results.length} product(s)`,
      results
   });
});

module.exports = {
   getPlanCacheStatus,
   resyncProduct,
   resyncAllProducts
};
