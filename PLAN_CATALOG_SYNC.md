# Stripe-Synced Plan Catalog

## What changed

Previously, every Stripe Price ID was a hardcoded `.env` variable
(`STRIPE_PRICE_PRO_MONTHLY`, etc). Changing a price meant creating a new
Stripe Price (prices are immutable — you can't edit the amount on an
existing one), copying the new ID into `.env`, and redeploying.

Then, pricing moved to a `Plan` collection in MongoDB, synced from Stripe
via webhooks — but adding a whole new plan tier still meant hand-editing
a `PLAN_SEED` array in code (name/level/features) and a `PLAN_HIERARCHY`
map, plus a `STRIPE_PRODUCT_IDS` env var.

Now there is **no code to touch per plan, ever**:

- `product.created` / `product.updated` webhooks auto-create/update the
  `Plan` document. There's no pre-seeded list of plans anywhere.
- Features (`dailyPlayLimit`, `canDownload`, `maxDownloads`, `adFree`)
  are read straight from the Stripe Product's metadata. A brand-new
  plan's entire feature set is defined in the Stripe Dashboard.
- `level` (upgrade/downgrade rank) is auto-derived: plans are sorted by
  their cheapest active price, ascending. Higher price = higher tier.
  Stripe has no concept of tier ordering, so this removes the last piece
  of business logic you'd otherwise have to hand-type per plan.
- The backfill script (`syncPlans.js`) calls `stripe.products.list()`
  and syncs everything Stripe returns — no hardcoded product-ID list, no
  `STRIPE_PRODUCT_IDS` env var.

Stripe is still the single source of billing truth. Mongo is a cache of
it — the app resolves `planKey + interval -> priceId` (and back) from
that cache instead of from `process.env` or a code file.

## New files

| File | Purpose |
|---|---|
| `src/models/plan.model.js` | Mongo schema for the plan catalog |
| `src/services/planCache.service.js` | In-memory cache, refreshed on sync |
| `src/services/planSync.service.js` | Pulls Product/Price data from Stripe, upserts into Mongo, derives `planKey`/`features`/`level` |
| `src/scripts/syncPlans.js` | Generic backfill: syncs every Stripe product |
| `src/controllers/planAdmin.controller.js` | Admin endpoints for manual resync (recovery path) |

## Changed files

- `src/config/plans.js` — delegates price-ID resolution to the cache
  instead of reading `process.env.STRIPE_PRICE_*`. No static
  `PLAN_HIERARCHY` map — a single `MIN_PAID_LEVEL = 1` constant is
  exported for "is this any paid plan at all" checks, since derived
  levels always start paid tiers at 1.
- `src/config/db.js` — loads the plan cache into memory right after
  Mongo connects, before the app serves traffic.
- `src/routes/webhook.routes.js` — whitelists `product.created`,
  `product.updated`, `price.created`, `price.updated`; the two product
  events both call `upsertProductFromStripe` (creating the Plan document
  IS what `product.created` does — there's no separate seeding step).
- `src/controllers/payment.controller.js`, `src/utils/accessControl.js`,
  `src/middlewares/mediaAccess.middleware.js` — switched from a static
  `PLAN_HIERARCHY` map (which assumed fixed plan names like `basic`) to
  reading levels/features from live cache data (`getPlans()`) or the
  `MIN_PAID_LEVEL` constant, since plan keys are no longer a fixed enum.
- `src/models/user.model.js`, `src/models/payment.model.js` — `plan`
  field is a plain (lowercased/trimmed) `String`, not a fixed enum,
  since valid plan keys can grow/shrink from the Stripe Dashboard alone.
- `src/routes/admin.routes.js` — added manual resync endpoints.
- `src/.env.example` — removed `STRIPE_PRODUCT_IDS`; documents the
  optional Product metadata keys instead.

## One-time Stripe Dashboard setup (per plan tier)

1. Create a Product, e.g. "Pro".
2. Optionally set `metadata.planKey` (e.g. `pro`) if you want a nicer
   internal key than what auto-slugifying the Product name would give
   you (`Pro` -> `pro` anyway, so usually you don't need this).
3. Set feature metadata on the Product:
   - `dailyPlayLimit` — a number, or `unlimited`/`null` for no limit
   - `canDownload` — `true` / `false`
   - `maxDownloads` — a number, or `unlimited`/`null` for no limit
   - `adFree` — `true` / `false`
   Anything left unset defaults to the least-privileged value (no
   downloads, no ad-free, etc), so an untagged plan can't accidentally
   grant more than intended.
4. Add recurring Prices to it (monthly/yearly).
5. Make sure your Stripe webhook endpoint has these events enabled (in
   addition to the existing subscription/invoice ones):
   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`

That's the entire setup. No `PLAN_SEED`, no `PLAN_HIERARCHY`, no env var,
no file in this repo to touch.

## First-time environment setup

```bash
node src/scripts/syncPlans.js
```

This calls `stripe.products.list()` and syncs every product Stripe
returns (and all of their prices) into Mongo, then recomputes every
plan's `level`. Safe to re-run any time as a full manual resync.

## Day-to-day: changing a price

1. In Stripe Dashboard, create a new Price on the existing Product (or
   edit and Stripe will prompt you to create a new one — prices are
   immutable on amount).
2. Archive the old Price in Stripe (optional but recommended).
3. Done. The webhook fires `price.created`/`price.updated`, syncs into
   Mongo, recomputes every plan's `level` (a price change can leapfrog
   another tier), and refreshes the in-memory cache. New checkouts use
   the new price immediately. Existing subscribers keep resolving
   correctly on their current price until they renew, upgrade, or you
   migrate them via Stripe's subscription schedule /
   `stripe.subscriptions.update` tooling (unchanged from before — this
   only affects catalog/price lookup, not existing subscription
   migration).

## Adding a whole new plan tier (e.g. "Ultra")

1. Create the Stripe Product + Prices in the Dashboard, tag the Product
   with the feature metadata described above.
2. That's it. `product.created` creates the `Plan` document; the
   webhook (or a `syncPlans.js` run) picks up the Prices; `level` is
   recomputed automatically based on where its cheapest price lands
   relative to your other plans.

There is no step 3 — no code file, enum, or env var to edit.

## How `level` (upgrade/downgrade rank) works

- The free tier is always level `0` (hardcoded — it isn't billed through
  Stripe, so there's nothing to rank it against).
- Every other plan is ranked by its cheapest **active** price, ascending:
  cheapest paid plan is level `1`, next is `2`, and so on.
- A plan with no active price yet (e.g. a Product just created, prices
  not synced in) has `level: null` until it gets one — there's nothing
  to compare it against.
- Recomputed after every price sync AND every product sync (see
  `recomputePlanLevels()` in `planSync.service.js`), since either can
  change the ordering — a new plan cheaper than an existing one, a price
  change that leapfrogs another tier, etc.
- **Multi-currency caveat**: levels compare raw price `amount` across
  plans regardless of currency. If you sell the same tier in multiple
  currencies, keep amounts roughly consistent across your currencies
  (or designate one currency as the reference) — mixing currencies with
  very different unit values (e.g. JPY vs USD) will rank plans
  incorrectly.

## Recovery: manual resync (admin-only)

If a webhook delivery is ever missed:

- `GET  /api/admin/plans/cache` — inspect what's currently cached
- `POST /api/admin/plans/resync` `{ "stripeProductId": "prod_xxx" }` —
  resync one product (creates its Plan document if it doesn't exist yet)
- `POST /api/admin/plans/resync-all` — pulls every product directly from
  Stripe (`stripe.products.list()`) and resyncs all of them, including
  ones never synced before

## Multi-instance note

The in-memory cache is per-process. If you run multiple instances behind
a load balancer, each instance refreshes independently when it happens
to receive the sync webhook. In practice this is fine (pricing changes
rarely, and each instance catches up via its own next webhook), but for
strict cross-instance consistency, swap `planCache.service.js`'s
in-memory `Map`s for a shared store (Redis) using the same
get/set/refresh shape.
