# Studio notification scheduler

This Worker is intentionally separate from the Next.js app. It wakes up every
15 minutes on Cloudflare Workers Free and calls Studio's protected notification
processor. It does not store application data.

## Configure

From this directory, set two secrets before deploying:

```bash
npx wrangler secret put APP_URL
npx wrangler secret put CRON_SECRET
```

`APP_URL` must be the deployed HTTPS URL of the Studio app, for example
`https://studio.example.vercel.app`. `CRON_SECRET` must exactly match the
`CRON_SECRET` environment variable configured on the Studio deployment.

## Deploy

```bash
npx wrangler deploy
```

The `*/15 * * * *` schedule is interpreted in UTC. The application itself
applies each user's configured reminder time and timezone before sending a
notification.

## Verify

This Worker intentionally has no public URL. Its only production entry point
is the scheduled trigger. To run the processor manually during development,
send a `POST` to `/run` with:

```text
Authorization: Bearer <CRON_SECRET>
```
