# Studio notification scheduler

This Worker is intentionally separate from the Next.js app. It wakes up every
minute on Cloudflare Workers Free and calls Studio's protected notification
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

The `* * * * *` schedule is interpreted in UTC. The application applies each
user's configured reminder time and timezone before sending notifications.
Cloudflare may take up to 15 minutes to propagate a changed Cron Trigger after
deployment; once active, automatic checks run about once per minute. The app
sends reminders once per configured day/time for orders matching the user's
due-soon, due-today, overdue, or enabled stalled-reminder rules. This is not a
repeat notification every minute.

## Verify

This Worker intentionally has no public URL. Its only production entry point
is the scheduled trigger. To run the processor manually during development,
send a `POST` to `/run` with:

```text
Authorization: Bearer <CRON_SECRET>
```
