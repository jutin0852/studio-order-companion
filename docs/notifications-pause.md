# Pausing and resuming notifications

Studio's notifications are **paused** while the database is unavailable (Neon's
free compute quota is used up for the month). While paused, nothing sends a
push and nothing queries the database on behalf of notifications.

## How the pause works

One switch, read before any database query or push attempt:

| `STUDIO_NOTIFICATIONS_PAUSED` | Result |
| --- | --- |
| unset, empty, `true`, anything else | **paused** (the default) |
| `false` | notifications run normally |

There is intentionally no "paused until" date. A date would switch
notifications back on by itself on 1 November whether or not the database is
reachable. They stay paused until someone sets the variable to `false`.

It is enforced in these places (all before the database):

- `src/lib/notifications.ts` `processDueNotifications` returns immediately.
- `src/lib/push.ts` `sendPushToUser` returns immediately.
- `POST /api/notifications/process` (the scheduler endpoint) answers `200 {"paused":true}`.
- `POST /api/notifications/test`, `POST` and `DELETE /api/notifications/subscription` answer `503` before the session lookup.
- Marking an order ready or delivered still saves, but skips the push.
- The Cloudflare Worker (`workers/notification-scheduler`) does not call the app at all; `NOTIFICATIONS_PAUSED` in `wrangler.jsonc` defaults to `"true"`.
- The app shows a "temporarily paused" notice in Settings > Notifications, hides the Today prompt and drops the "Turn on reminders" setup step.

Nothing is deleted: push subscriptions, notification preferences, reminder
records, user settings and migrations are left exactly as they are.

## Resuming (only after the database is confirmed reachable)

1. Confirm the database works: run `npm run db:verify` against production, or sign in to the app and see that `/` loads instead of the recovery page.
2. In Vercel, set `STUDIO_NOTIFICATIONS_PAUSED=false` for Production and redeploy (environment changes apply to new deployments).
3. In `workers/notification-scheduler/wrangler.jsonc` set `NOTIFICATIONS_PAUSED` to `"false"`, then run `npx wrangler deploy` from that folder.
4. Optional: `POST /api/notifications/process` with the cron secret; the response should no longer contain `"paused": true`.

Before resuming, also lower how often the worker runs (see the schedule in
`wrangler.jsonc`). Running every minute kept the database awake around the
clock and is what used up the free compute quota.

To pause again, set the variable back to `true` (or remove it) and redeploy.
