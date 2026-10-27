# Studio: order companion for online sellers

[![CI](https://github.com/jutin0852/studio-order-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/jutin0852/studio-order-companion/actions/workflows/ci.yml)

Order tracking, reminders and light business management for small online sellers.
Installable as a phone app (PWA), with push notifications for due orders.

**Live:** https://studio-tau-eight-46.vercel.app

## Features
- Orders with due dates, status tracking, snoozing and idempotent creation (no duplicate orders on retry)
- Product catalogue with images, and expense tracking
- Receipts in naira, with amount in words, voiding and shareable receipt images
- Web Push reminders (due soon, due today, overdue) with per-device opt-in and daily de-duplication
- Email/password and Google sign-in, with password recovery

## Stack
Next.js (App Router, route handlers) · React · TypeScript · PostgreSQL on Neon (`pg`, SQL migrations in `db/migrations`) ·
Better Auth · Web Push (VAPID) · Cloudinary (signed uploads) · Resend (email) · Cloudflare Worker cron

## Architecture
- `src/app/api/*`: REST-style route handlers for orders, products, expenses, receipts, settings, uploads and notifications
- `db/migrations`: ordered SQL migrations (domain schema, push subscriptions, idempotency, snoozes, reminder claims, receipts)
- `workers/notification-scheduler`: Cloudflare Worker that calls the protected reminder processor every 15 minutes
- `src/lib`: framework-independent logic (validation, field limits, reminder-day maths, receipts, secret comparison), unit-tested

## Testing
Unit tests use the Node built-in test runner and cover the logic most likely to cause bugs:
request body size limits, field-length limits, auth/host configuration (production excludes dev hosts), constant-time secret comparison,
push endpoint validation, image URL validation, reminder-day calculation, naira amount-in-words, receipts, and the scheduler worker.

API tests (Vitest) run the real route handlers and SQL against an in-memory Postgres (PGlite) with every migration applied.
Only sign-in and push delivery are replaced. They cover orders (including replay protection and cross-business privacy), products,
receipts and numbering, notification preferences, rate limiting and the random check-in scheduler.

```bash
npm test          # unit tests
npm run test:api  # API tests against an in-memory database
npm run test:all  # both
npm run lint
```

CI (GitHub Actions) runs lint, both test suites and a production build on every push and pull request.
Not covered yet: browser end-to-end tests.

## Getting started
```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run db:migrate
npm run dev
```

## Deployment

Deploy the Next.js app to your chosen Node-compatible host. Keep `CLOUDINARY_API_SECRET`, `BETTER_AUTH_SECRET`, and the database credentials server-side.

## Authentication setup

Studio uses self-hosted [Better Auth](https://better-auth.com/) with Neon/PostgreSQL. Copy `.env.example` to `.env.local`, add a Neon pooled connection string, and generate a long random `BETTER_AUTH_SECRET`.

Then create the Better Auth tables in Neon:

```bash
npm run auth:migrate
```

Google sign-in is enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present. Add this redirect URI to the Google OAuth web client:

```text
http://localhost:3010/api/auth/callback/google
```

For phone testing over the local network, use a domain-style LAN host (for example one built with nip.io) `http://<your-lan-host>:3010` and allow `http://<your-lan-host>:3010/api/auth/callback/google` in Google Cloud. Keep `BETTER_AUTH_ALLOWED_HOSTS` in sync with the LAN host.

Email verification is intentionally optional. Password recovery sends through Resend when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured; in local development, the reset link is logged for testing when those values are absent.

## Push notification setup

Studio uses browser Web Push so a seller can get actionable order reminders even when the app is not open. The first slice covers:

- explicit device opt-in from Settings;
- persistent per-user device subscriptions in `push_subscriptions`;
- due-soon, due-today, and overdue reminders with daily deduplication;
- ready-to-send and delivered status notifications;
- notification actions that open the Orders screen;
- per-device removal and a Send test control.

Generate one VAPID key pair and keep the private key server-side:

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and a long random `CRON_SECRET` in `.env.local`. The schema migration adds `push_subscriptions` and a reminder dedupe key:

```bash
npm run db:migrate
```

The processor is intentionally a protected endpoint because the Next.js app cannot wake itself while the phone is closed. Run it every 5–15 minutes with a scheduler that can reach the deployed app:

```bash
npm run notifications:process
```

For a no-subscription production scheduler, deploy the small Cloudflare Worker
in `workers/notification-scheduler`. It uses Cloudflare Workers Free's cron
trigger to call the processor every 15 minutes. Set its `APP_URL` secret to the
deployed HTTPS Studio URL and its `CRON_SECRET` secret to the same value used by
the Studio deployment, then run `npx wrangler deploy` from that directory.

The phone must use an HTTPS origin for web push. `localhost` is allowed for development, but a LAN HTTP address such as `<your-lan-host>` will show the user how to fix the secure-context requirement instead of silently failing.

## Image storage setup

Studio uses [Cloudinary](https://cloudinary.com/) for optional product and business-logo images. The browser resizes images to WebP, limits the longest side to 1600px, and rejects uploads above 900 KB before upload so the images stay fast on phones. Uploads are signed by the server and placed in a per-user folder; the API secret never reaches the browser.

1. Create a Cloudinary account and open the Product environment API keys page.
2. Copy the cloud name, API key, and API secret into `.env.local` using the `CLOUDINARY_*` variables from `.env.example`.
3. Keep `CLOUDINARY_API_SECRET` server-only. Do not expose it as a `NEXT_PUBLIC_*` variable.

The current app uses Cloudinary's browser upload API with a short-lived server-generated signature. Cloudinary's free plan is suitable for early testing; monitor the account's monthly usage as the catalog grows.
