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
   earliest real reminder and the earliest random check-in. A reminder only
   counts on a day an order actually has one, and a check-in only counts on a day
   the person has an order that is late or due within 3 days.
3. The object sets its alarm for that time and stops. Nothing runs in between.
4. When someone changes something that affects the times (a new order, a due
   date, a snooze, a reminder time, awake hours), the app calls `/reschedule`.
   The alarm is brought forward to a minute away, so a burst of edits becomes
   one run, and the new time is worked out then. The database is already awake
   at that moment because the person just saved something.
5. If nothing is due today or tomorrow, the alarm is set a day away. That daily
   check finds every later reminder in time.
6. The time is kept between 1 minute and 49 hours ahead, whatever the app says,
   so a bad answer cannot cause a storm or days of silence.
7. After a failed run (for example the database is down or over quota) the next
   alarm is 10 minutes away, doubling each time up to 6 hours. A new alarm is always
   set, so the chain never breaks, and a lasting failure cannot keep waking the
   database. A success clears the back-off.
8. A notification that could not be delivered is retried after 5 minutes, at most 3
   times in a row. After that it waits for the next real notification time, so one
   broken device cannot keep the database awake.

If a `/reschedule` call is lost, that edit takes effect at the next alarm.

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

After the first deploy, set `NOTIFICATIONS_SCHEDULER_URL` on the Studio deployment
to the Worker's `workers.dev` address, which `wrangler deploy` prints. Without it
the app cannot tell the Worker about changes, and edits wait for the next alarm.

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

The Worker has a public address so the app can reach `/reschedule`. `/reschedule`
and `/run` both require the secret, and `/run` calls the processor immediately:

```text
Authorization: Bearer <CRON_SECRET>
```

A manual run also sets the next alarm.
