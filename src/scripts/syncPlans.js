/**
 * =====================================
 * 🌱 BACKFILL PLAN CATALOG FROM STRIPE (OPTIONAL BOOTSTRAP ONLY)
 * =====================================
 * You should NEVER need to run this after initial setup. Once
 * price.created/price.updated/product.created/product.updated webhooks
 * are configured in the Stripe Dashboard (see webhook.routes.js), every
 * catalog change reaches Mongo automatically, in the same request
 * Stripe delivers the webhook. There is no steady-state dependency on
 * this script.
 *
 * The only reason it exists: on a genuinely fresh environment, Mongo
 * starts empty and there's no event to wait for — nothing changed in
 * Stripe, so no webhook fires. This script is that one-time bridge.
 * There's also an admin HTTP endpoint
 * (POST /admin/plans/resync-all, see planAdmin.controller.js) if you'd
 * rather trigger a resync without shell access, e.g. for disaster
 * recovery after a missed webhook window.
 *
 * Run this:
 *   - once, when setting up a brand new environment (dev/staging/prod)
 *   - after disaster recovery, if you suspect Mongo drifted from Stripe
 *     during a period the webhook endpoint was unreachable
 *
 * USAGE:
 *   node src/scripts/syncPlans.js
 *
 * WHAT IT DOES:
 *   Calls stripe.products.list() and syncs EVERY product Stripe returns
 *   (and all of its prices) into the `Plan` collection — see
 *   syncAllProductsFromStripe() in services/planSync.service.js.
 *
 * THERE IS NO PRODUCT-ID LIST HERE. Add a product in Stripe (tag its
 * metadata with whatever features/planKey you want — see
 * planSync.service.js), then either run this script once or just wait
 * for the `product.created` webhook to do the same thing automatically.
 *
 * NOTE ON RE-RUNNING:
 *   Safe and idempotent. `name`/`features`/`isActive` are re-read from
 *   the Product every time (so Stripe stays the source of truth for
 *   those); `level` is recomputed from current pricing across all plans
 *   every time too. Nothing here is hand-maintained.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { syncAllProductsFromStripe } = require('../services/planSync.service');
const { loadPlanCache } = require('../services/planCache.service');

async function main() {

   const mongoUri = process.env.MONGO_URI;

   if (!mongoUri) {
      throw new Error('MONGO_URI is not set in .env');
   }

   await mongoose.connect(mongoUri);
   console.log('✅ Connected to Mongo');

   console.log('↻ Pulling every product from Stripe...');

   const results = await syncAllProductsFromStripe();

   for (const result of results) {
      console.log(
         `  ✔ ${result.planKey} (${result.stripeProductId}) — ` +
         `synced ${result.syncedPriceIds.length} price(s)`
      );
   }

   await loadPlanCache();

   console.log(`✅ Plan catalog sync complete — ${results.length} product(s) synced`);

   await mongoose.disconnect();
   process.exit(0);
}

main().catch((err) => {
   console.error('🔥 syncPlans failed:', err);
   process.exit(1);
});
