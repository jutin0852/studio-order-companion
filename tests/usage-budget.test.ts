import { describe, expect, it } from "vitest";
import { nextRunAt, type NextRunRow } from "@/lib/next-run";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// Neon's free plan allows 100 compute-hours a month per project.
const FREE_COMPUTE_HOURS = 100;
// The smallest compute, which is what this project runs at, and how long it stays
// up after the last query.
const COMPUTE_UNITS = 0.25;
const IDLE_MINUTES = 5;

const people = (count: number): NextRunRow[] => Array.from({ length: count }, (_, index) => ({
  user_id: `user-${index}`,
  push_enabled: true,
  random_alerts_enabled: true,
  random_alerts_per_day: 3,
  awake_start: "08:00",
  awake_end: "21:00",
  reminder_time: "09:00",
  timezone: "Africa/Lagos",
}));

/** Follows the schedule for a month, as the Worker would, and lists every wake-up. */
function monthOfWakeUps(rows: NextRunRow[]) {
  const start = Date.UTC(2026, 10, 2);
  const wakeUps: number[] = [];
  let now = new Date(start);
  while (now.getTime() < start + 30 * DAY) {
    now = nextRunAt(rows, now);
    wakeUps.push(now.getTime());
  }
  return wakeUps;
}

/** Compute-hours for a list of wake-ups, where close ones share the same awake time. */
function computeHours(wakeUps: number[]) {
  let awake = 0;
  let awakeUntil = 0;
  for (const wakeUp of [...wakeUps].sort((a, b) => a - b)) {
    const from = Math.max(wakeUp, awakeUntil);
    const until = wakeUp + IDLE_MINUTES * MINUTE;
    if (until > from) awake += until - from;
    awakeUntil = Math.max(awakeUntil, until);
  }
  return (awake / (60 * MINUTE)) * COMPUTE_UNITS;
}

describe("a month of notifications stays inside Neon's free compute", () => {
  it("the old every-minute schedule would not (this is what caused the outage)", () => {
    const start = Date.UTC(2026, 10, 2);
    const everyMinute = Array.from({ length: 30 * 24 * 60 }, (_, minute) => start + minute * MINUTE);
    expect(computeHours(everyMinute)).toBeGreaterThan(FREE_COMPUTE_HOURS);
  });

  it("the current four active people use well under half the allowance", () => {
    const hours = computeHours(monthOfWakeUps(people(4)));
    expect(hours).toBeLessThan(FREE_COMPUTE_HOURS / 2);
  });

  it("never needs a wake-up more often than once a minute, even with more people", () => {
    const wakeUps = monthOfWakeUps(people(20));
    for (let index = 1; index < wakeUps.length; index += 1) {
      expect(wakeUps[index] - wakeUps[index - 1]).toBeGreaterThanOrEqual(MINUTE);
    }
  });
});
