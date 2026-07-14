# Spotify Clone — Backend API

Backend REST API for a Spotify-like music streaming platform, with subscription plans
billed through Stripe. This repo is backend-only — no frontend is included.

## Features

- JWT access tokens + rotating, HMAC-hashed refresh tokens (with replay detection)
- Email/password auth + Google OAuth login
- Music upload, streaming, download, search, trending, history
- Albums
- Playlists (create, add/remove songs)
- Queue system (add, next/prev, shuffle, repeat)
- Likes
- User profiles + avatar upload
- Artist request/approval workflow
- Admin controls (ban/unban users, approve/reject artists, plan resync)
- Subscription plans synced live from Stripe (products/prices → Mongo via webhooks)
- Rate limiting (upload, search, and global limits in production)

---

## Tech Stack

- Node.js / Express 5
- MongoDB + Mongoose (uses transactions — requires a replica set)
- JWT (`jsonwebtoken`) + Passport (Google OAuth)
- Stripe (subscriptions, checkout, billing portal, webhooks)
- ImageKit (audio/image file storage)
- Multer + `file-type` (upload handling/validation)
- express-validator, helmet, express-rate-limit

---

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in real values.
See the comments in `.env.example` for what each one does and where to get it —
highlights:

- `MONGO_URI` must point to a replica-set-enabled MongoDB (local dev needs
  `?replicaSet=rs0`; MongoDB Atlas free tier works out of the box).
- `JWT_ACCESS_SECRET` and `REFRESH_TOKEN_HMAC_SECRET` should be long random
  strings (`openssl rand -hex 64`), kept separate from each other.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — use Stripe **test mode** keys
  during development.
- `GOOGLE_CALLBACK_URL` must match a redirect URI registered in Google Cloud
  Console for your OAuth client.
- After first deploy with real Stripe products, run:
  ```bash
  node src/scripts/syncPlans.js
  ```
  to backfill the `Plan` collection from Stripe.

## Run Server

```bash
npm run dev     # nodemon, auto-restart
npm start        # plain node
```

## API Base URL

```
http://localhost:3000/api
```

A basic health check is available at `GET /health` (outside the `/api` prefix) —
useful for uptime monitors and PaaS health checks.

---

# Endpoints

All routes below are relative to `/api` unless noted. Routes marked 🔒 require
a valid access token; 🔒👑 requires an admin role.

## Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register with email/password |
| POST | `/login` | Login with email/password |
| GET | `/google` | Start Google OAuth flow |
| GET | `/google/callback` | Google OAuth callback |
| POST | `/refresh-token` | Rotate access/refresh tokens |
| POST | `/logout` | Revoke current refresh token family |

## Music — `/api/music`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/all-songs` | List all songs |
| GET | `/all-albums` | List all albums |
| GET | `/albums/:albumId` | Get one album |
| GET | `/search/songs` | Search songs |
| GET | `/search/artists` | Search artists |
| GET | `/trending` | Trending songs |
| POST | `/play/:songId` | 🔒 Record a play / get playback access |
| GET | `/stream/:songId` | 🔒 Stream audio |
| GET | `/download/:songId` | 🔒 Download (plan-gated) |
| GET | `/history` | 🔒 Listening history |
| POST | `/upload` | 🔒 Upload a song (rate-limited) |
| POST | `/album` | 🔒 Create an album |

## Users — `/api/users`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/me` | 🔒 Current user profile |
| GET | `/me/features` | 🔒 Current plan's feature flags |
| PATCH | `/me` | 🔒 Update profile |
| POST | `/me/avatar` | 🔒 Upload avatar |
| POST | `/set-password` | 🔒 Set/change password (e.g. after Google signup) |
| POST | `/artist/request` | 🔒 Request artist status |

## Likes — `/api/likes`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/like` | 🔒 Like a song |
| POST | `/unlike` | 🔒 Unlike a song |
| GET | `/likes/:songId` | 🔒 Check like status |

## Playlists — `/api/playlists`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | 🔒 Create playlist |
| POST | `/add-song` | 🔒 Add song to playlist |
| POST | `/remove-song` | 🔒 Remove song from playlist |
| GET | `/user` | 🔒 List my playlists |
| GET | `/:playlistId` | 🔒 Get one playlist |
| DELETE | `/:playlistId` | 🔒 Delete playlist |

## Queue — `/api/queue`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/add` | 🔒 Add song to queue |
| POST | `/shuffle` | 🔒 Shuffle queue |
| POST | `/repeat` | 🔒 Set repeat mode |
| GET | `/current` | 🔒 Currently playing |
| POST | `/next` | 🔒 Skip to next |
| POST | `/prev` | 🔒 Back to previous |
| GET | `/all` | 🔒 View full queue |
| DELETE | `/clear` | 🔒 Clear queue |

## Payments — `/api/payment`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/plans` | List available subscription plans |
| POST | `/checkout` | 🔒 Start Stripe Checkout session |
| POST | `/change-plan` | 🔒 Switch subscription plan |
| GET | `/subscription/status` | 🔒 Current subscription status |
| GET | `/history` | 🔒 Payment history |
| POST | `/billing-portal` | 🔒 Get Stripe billing portal link |
| DELETE | `/subscription` | 🔒 Cancel subscription |
| POST | `/subscription/resume` | 🔒 Resume a canceled subscription |

## Admin — `/api/admin` (all 🔒👑)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/artists/pending` | List pending artist requests |
| PATCH | `/artists/:userId/approve` | Approve artist request |
| PATCH | `/artists/:userId/reject` | Reject artist request |
| PATCH | `/users/:userId/ban` | Ban a user |
| PATCH | `/users/:userId/unban` | Unban a user |
| GET | `/plans/cache` | View plan cache status |
| POST | `/plans/resync` | Resync one product from Stripe |
| POST | `/plans/resync-all` | Resync all products from Stripe |

## Webhooks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhook` | Stripe webhook receiver (registered separately in `app.js`, ahead of `express.json()`, since Stripe requires the raw request body for signature verification) |

---

## Deployment Notes

- Requires a MongoDB **replica set** (transactions are used) — MongoDB Atlas's
  free M0 tier satisfies this automatically.
- Set `NODE_ENV=production` on your host — this enables global rate limiting.
- Update `GOOGLE_CALLBACK_URL`, `CLIENT_URL`, `STRIPE_SUCCESS_URL`,
  `STRIPE_CANCEL_URL`, and `ALLOWED_ORIGINS` to your real deployed URLs —
  don't leave them pointing at `localhost` or a temporary tunnel.
- Register a webhook endpoint in the Stripe dashboard pointing at your
  deployed `/api/webhook` URL; use the `whsec_...` value Stripe issues for
  *that* endpoint, not a locally-generated one.
- Use Stripe **test mode** keys unless you intend to process real payments.

---

## Postman Collection

See `Spotify Clone API.postman_collection.json` and
`Spotify Clone.postman_environment.json` in this repo for a ready-to-import
request collection covering all endpoints above.

---

## Author

Saim Khan