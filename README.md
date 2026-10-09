This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

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

For phone testing over the local network, use the domain-style LAN host `http://192.168.1.3.nip.io:3010` and allow `http://192.168.1.3.nip.io:3010/api/auth/callback/google` in Google Cloud. Keep `BETTER_AUTH_ALLOWED_HOSTS` in sync with the LAN host.

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

The phone must use an HTTPS origin for web push. `localhost` is allowed for development, but a LAN HTTP address such as `192.168.1.3.nip.io` will show the user how to fix the secure-context requirement instead of silently failing.

## Image storage setup

Studio uses [Cloudinary](https://cloudinary.com/) for optional product and business-logo images. The browser resizes images to WebP, limits the longest side to 1600px, and rejects uploads above 900 KB before upload so the images stay fast on phones. Uploads are signed by the server and placed in a per-user folder; the API secret never reaches the browser.

1. Create a Cloudinary account and open the Product environment API keys page.
2. Copy the cloud name, API key, and API secret into `.env.local` using the `CLOUDINARY_*` variables from `.env.example`.
3. Keep `CLOUDINARY_API_SECRET` server-only. Do not expose it as a `NEXT_PUBLIC_*` variable.

The current app uses Cloudinary's browser upload API with a short-lived server-generated signature. Cloudinary's free plan is suitable for early testing; monitor the account's monthly usage as the catalog grows.
