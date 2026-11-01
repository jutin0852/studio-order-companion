# How a notification scheduler used up a free database and took an app offline

A write-up of an outage in Studio (a Next.js app on Vercel, with Postgres on
Neon's free plan), written so other teams can avoid the same mistake. It has no
secrets and nothing in it is specific to Studio's business logic.

## What users saw

Opening the app showed a generic "This page couldn't load. A server error
occurred. Reload to try again." screen with an error number. Reload did nothing,
because every reload failed the same way.

## What was actually wrong

The production logs held the real error, under the same digest number the screen
showed:

```
error: Your account or project has exceeded the quota. Upgrade your plan to
increase limits.   (Postgres error code 53000)
```

Neon's free plan gives each project about **100 compute-hours a month**. The
project had used **110**, so Neon suspended the database. Every request that
needed the database failed, and almost every page does, because the first thing
the app does is look up your login session. Storage (33 MB) and network transfer
(64 MB) were nowhere near their limits. Only compute ran out.

## Why compute ran out in 20 days

A scheduler (a Cloudflare Worker) called the app's `/api/notifications/process`
endpoint **every minute** to ask "is any reminder due?". Each call ran a query.

- A serverless Postgres like Neon bills compute for as long as it is awake, and
  only suspends after about **5 idle minutes**.
- A query every minute means it is never idle for 5 minutes, so it never sleeps.
- At the smallest size (0.25 CU) that is about 180 compute-hours a month, against
  a 100-hour allowance. The quota was always going to run out in about three
  weeks, even with no real users.

Nothing was broken in the code. The design simply cost more than the plan
allowed, and nothing warned anyone.

## What made it worse

1. **The scheduler never backed off.** After the database was blocked it kept
   calling every minute and logging errors.
2. **Each run did more work than needed.** The processor loaded every unfinished
   order for every user on each run, just to decide that nothing was due.
3. **No graceful failure.** The home page required the database, so an outage
   looked like a crash with no explanation.
4. **No usage alert.** The limit was only discovered when the app broke.
5. **The data was trapped.** A suspended project cannot be dumped, queried or
   branched. A manual snapshot taken on the day was created, but restoring or
   inspecting it failed with the same quota error. The only ways out were to wait
   for the monthly reset or to pay.
6. **The cost model wasn't known.** "Free plan" was treated as "unlimited while
   small". Free plans have per-project quotas that scheduled work can exhaust
   without any traffic.

## What was done

- **Paused all notifications** with a kill switch that is checked before any
  database query or push, in the scheduler endpoint, the push sender, the test
  button, the device-registration routes and the scheduler itself. It stays
  paused unless explicitly switched on, so it cannot restart by date before the
  database is confirmed healthy. See `notifications-pause.md`.
- **Added an offline recovery page** (`/recover`) that lets people open or
  download the copy of their data cached on their own device, and made the
  normal route fall back to it when the database connection fails.
- **Reworked the scheduler** so the database is only woken when something is
  actually due (design below).

## The design that avoids this

Do not poll the database to find out whether there is work. Work out when the
next piece of work is due, and set one timer for that moment.

1. After each run, the app computes the next moment anything is actually due:
   the earliest real reminder and each user's next random check-in.
2. The scheduler sets a single timer for that time (a Cloudflare Durable Object
   alarm) and stops. Nothing runs in between: no per-minute tick at all.
3. When the timer fires, the scheduler calls the app, and the cycle repeats.
4. When someone changes something that affects the times, the app tells the
   scheduler straight away and the timer is recalculated.
5. If a run fails, the next timer is set about 10 minutes out, so it neither
   hammers a broken database nor stops for good.
6. If nothing is due for two days, it checks once a day. A slow watchdog only
   confirms a timer exists, in case the chain ever stops.

With default settings each person with open orders causes about four wake-ups a
day (one reminder, three check-ins), against 1,440 before. At roughly five minutes
awake each, that is under 3 compute-hours a month per person, instead of 180 in
total. Wake-ups that land close together share the same awake time. Real app use
then matters more than notifications, because every session wakes the database too.

Honest limits: with hundreds or thousands of users, something is due almost
every minute, so the database stays awake anyway and a paid plan is the right
answer. At that size the processor must also stop loading every user's orders on
each run, and must send pushes in batches rather than one at a time inside one
serverless call.

## Checklist for your own app

- [ ] Know the free plan's per-project limits and write down which one your
      scheduled work consumes (compute hours, requests, transfer, storage).
- [ ] Never poll a serverless database on a short interval. Compute the next due
      time and wake it then.
- [ ] Make every scheduler back off after failures, with a cap, and log when it
      does.
- [ ] Give background jobs a kill switch that is read **before** any database
      work, and default it to the safe state.
- [ ] Make the front page degrade gracefully when the database is down: a clear
      message, and cached or offline data where possible.
- [ ] Set up usage alerts, or check the usage page weekly, well before 100%.
- [ ] Keep an export you can actually use: take regular dumps to storage you
      control. A provider snapshot or branch is not reachable if the project is
      suspended.
- [ ] Log the underlying error somewhere you can search by the id users see.
- [ ] Decide in advance what happens at the quota: who is told, what is paused
      and how to resume.

## Timeline (October 2026)

- Oct 9: project created, scheduler running every minute.
- Oct 29: app shows the generic error. Logs show Postgres code 53000. The Neon
  console shows 110.21 of 100 compute-hours used.
- Oct 29: notifications paused, offline recovery page deployed.
- Next: next-alarm scheduler, then resume notifications once the database is
  confirmed reachable.
