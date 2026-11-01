# Studio notification scheduler

This Worker is intentionally separate from the Next.js app. It calls Studio's
protected notification processor at the time the next notification can be due,
and not otherwise. It does not store application data.

## How it decides when to run

The processor queries the database, and calling it every minute kept a serverless
Postgres awake around the clock until its free compute quota ran out. See
`docs/postmortem-notification-database-quota.md`.

So there is no per-minute schedule. A single Durable Object holds one alarm:

1. When the alarm fires, the object calls the processor.
2. The app sends any notifications that are due and answers with `nextRunAt`: the
   earliest of every person's next reminder time, their next random check-in,
   and a safety check 60 minutes away.
3. The object sets its alarm for that time and stops. Nothing runs in between.
4. The time is kept between 1 minute and 2 hours ahead, whatever the app says, so
   a bad answer cannot cause a storm or a day of silence.
5. After a failed run (for example the database is down or over quota) the next
   alarm is 10 minutes away. A new alarm is always set, so the chain never breaks.
6. Changes made during the day, such as a new reminder time or a new order, are
   picked up by the 60-minute safety check.

The cron trigger (`*/30 * * * *`) is a watchdog, not the schedule. It only makes
sure an alarm exists, which starts the chain after the first deploy or a resume.
It never calls the app.

Alarms run at least once, so a run can occasionally repeat. That is safe because
the app records each reminder and will not send it twice.

Durable Objects are available on the Workers Free plan using the SQLite backend,
which `migrations` in `wrangler.jsonc` selects. There is nothing to create by
hand: the first `npx wrangler deploy` sets it up.

## Configure

From this directory, set two secrets before deploying:

```bash
npx wrangler secret put APP_URL
```

```bash
npx wrangler secret put CRON_SECRET
```

`APP_URL` must be the deployed HTTPS URL of the Studio app, for example
`https://studio.example.vercel.app`. `CRON_SECRET` must exactly match the
`CRON_SECRET` environment variable configured on the Studio deployment.

## Deploy

```bash
npx wrangler deploy
```

Cloudflare may take up to 15 minutes to propagate a changed Cron Trigger after
deployment. When a user saves their alert time, the application records that
device's IANA time zone and applies the configured local reminder time before
sending notifications. The app sends reminders once per configured day/time for
orders matching the user's due-soon, due-today, overdue, or enabled
stalled-reminder rules.

## Pausing

`NOTIFICATIONS_PAUSED` in `wrangler.jsonc` defaults to `"true"`: the alarm makes
no request and no new alarm is set, and the watchdog starts nothing. Set it to
`"false"` and redeploy to resume, only after the database is confirmed reachable.
The watchdog then starts the alarm within 30 minutes. See
`docs/notifications-pause.md`.

## Verify

This Worker intentionally has no public URL. Its only production entry points
are the alarm and the watchdog. To run the processor manually during development,
send a `POST` to `/run` with:

```text
Authorization: Bearer <CRON_SECRET>
```

A manual run also sets the next alarm.
