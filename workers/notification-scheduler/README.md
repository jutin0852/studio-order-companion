# Studio notification scheduler

This Worker is intentionally separate from the Next.js app. It wakes up every
minute on Cloudflare Workers Free, but on most ticks it does nothing: it only
calls Studio's protected notification processor when something can be due. It
does not store application data.

## Why it does not call the app every minute

The processor queries the database. Calling it every minute kept a serverless
Postgres awake around the clock and used up its free compute quota. See
`docs/postmortem-notification-database-quota.md`.

Instead:

1. After each run, the app answers with `nextRunAt`: the earliest of every
   person's next reminder time, their next random check-in, and a safety check
   60 minutes away.
2. The Worker saves that time in a Cloudflare KV key (`next-run-at`).
3. Each minute the Worker reads the saved time. If it has not arrived, the tick
   ends there, with no request to the app and no database work.
4. The Worker keeps the saved time between 1 minute and 2 hours ahead, whatever
   the app says, so a bad answer cannot cause a storm or a day of silence.
5. After a failed run (for example the database is down or over quota) it waits
   10 minutes before trying again.
6. Changes made during the day, such as a new reminder time or a new order, are
   picked up by the 60-minute safety check.

If the `SCHEDULE` KV binding is missing the Worker logs an error and falls back
to calling the app every 20 minutes rather than every tick.

Cloudflare's free KV allows 1,000 writes a day. The Worker writes once per
run, so this is fine for a small user base. With many users, runs approach one
a minute and the write limit would be reached.

## Configure

From this directory, create the KV store once and put its id in
`wrangler.jsonc` (replace `REPLACE_WITH_KV_NAMESPACE_ID`):

```bash
npx wrangler kv namespace create SCHEDULE
```

Then set two secrets before deploying:

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

The `* * * * *` schedule is interpreted in UTC. When a user saves their alert
time, the application records that device's IANA time zone and applies the
configured local reminder time before sending notifications. Cloudflare may
take up to 15 minutes to propagate a changed Cron Trigger after deployment. The
app sends reminders once per configured day/time for orders matching the user's
due-soon, due-today, overdue, or enabled stalled-reminder rules. This is not a
repeat notification every minute.

## Pausing

`NOTIFICATIONS_PAUSED` in `wrangler.jsonc` defaults to `"true"`: the Worker
makes no request and writes nothing to KV. Set it to `"false"` and redeploy to
resume, only after the database is confirmed reachable. See
`docs/notifications-pause.md`.

## Verify

This Worker intentionally has no public URL. Its only production entry point
is the scheduled trigger. To run the processor manually during development,
send a `POST` to `/run` with:

```text
Authorization: Bearer <CRON_SECRET>
```

A manual run also updates the saved next run time.
