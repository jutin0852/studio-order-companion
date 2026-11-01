import {
  DEFAULT_ALERTS_PER_DAY,
  DEFAULT_AWAKE_END,
  DEFAULT_AWAKE_START,
  isValidAwakeWindow,
  minutesFromTime,
  randomAlertSlots,
} from "@/lib/random-alerts";
import { localDateKey, localMinutes, nextDateKey, validTimeZoneOrDefault, zonedTimeToDate } from "@/lib/schedule-time";

/**
 * How long to wait when nothing is due today or tomorrow. A run looks that far
 * ahead, so checking once a day finds every later reminder in time. Changes reach
 * the scheduler straight away (see notification-scheduler.ts).
 */
export const SAFETY_CHECK_MINUTES = 24 * 60;
/** How soon to retry when a notification could not be delivered. The scheduler caps how many times. */
export const DELIVERY_RETRY_MINUTES = 5;
/** The scheduler is never asked to call back sooner than this. */
const MIN_WAIT_MINUTES = 1;

export type NextRunRow = {
  user_id: string;
  push_enabled: boolean;
  random_alerts_enabled: boolean;
  random_alerts_per_day: number;
  awake_start: string;
  awake_end: string;
  reminder_time: string;
  timezone: string;
};

const MINUTE = 60_000;

function earliest(current: Date | null, candidate: Date | null) {
  if (!current) return candidate;
  return candidate && candidate < current ? candidate : current;
}

// A reminder fires once its time has passed, so the next one is today at the
// reminder time if that is still ahead, otherwise tomorrow. Only a day this order
// really has a reminder on counts.
function nextReminder<Row extends NextRunRow>(row: Row, timeZone: string, now: Date, hasReminderOn: (row: Row, date: string) => boolean) {
  const reminderMinutes = minutesFromTime(row.reminder_time) ?? 9 * 60;
  const today = localDateKey(now, timeZone);
  const tomorrow = nextDateKey(today);
  const days = reminderMinutes > localMinutes(now, timeZone) ? [today, tomorrow] : [tomorrow];
  const date = days.find((day) => hasReminderOn(row, day));
  return date ? zonedTimeToDate(date, reminderMinutes, timeZone) : null;
}

function nextRandomAlert(row: NextRunRow, timeZone: string, now: Date) {
  const awakeFits = isValidAwakeWindow(row.awake_start, row.awake_end);
  const startMinutes = minutesFromTime(awakeFits ? row.awake_start : DEFAULT_AWAKE_START) as number;
  const endMinutes = minutesFromTime(awakeFits ? row.awake_end : DEFAULT_AWAKE_END) as number;
  const count = row.random_alerts_per_day || DEFAULT_ALERTS_PER_DAY;
  const today = localDateKey(now, timeZone);
  const nowMinutes = localMinutes(now, timeZone);

  const todaysSlots = randomAlertSlots({ userId: row.user_id, date: today, count, startMinutes, endMinutes });
  const upcoming = todaysSlots.find((slot) => slot > nowMinutes);
  if (upcoming !== undefined) return zonedTimeToDate(today, upcoming, timeZone);

  const tomorrow = nextDateKey(today);
  const [first] = randomAlertSlots({ userId: row.user_id, date: tomorrow, count, startMinutes, endMinutes });
  return zonedTimeToDate(tomorrow, first, timeZone);
}

/**
 * When the scheduler should next call the processor: the earliest of every real
 * reminder and every user's next random check-in, or the daily check when nothing
 * is coming up. Users with notifications off are ignored. Never earlier than a
 * minute from now.
 */
export function nextRunAt<Row extends NextRunRow>(
  rows: Row[],
  now: Date,
  options: { hasReminderOn?: (row: Row, date: string) => boolean } = {},
) {
  const hasReminderOn = options.hasReminderOn ?? (() => true);
  let next: Date | null = null;

  const usersSeen = new Set<string>();
  for (const row of rows) {
    if (!row.push_enabled) continue;
    const timeZone = validTimeZoneOrDefault(row.timezone);
    next = earliest(next, nextReminder(row, timeZone, now, hasReminderOn));
    if (usersSeen.has(row.user_id)) continue;
    usersSeen.add(row.user_id);
    if (row.random_alerts_enabled) next = earliest(next, nextRandomAlert(row, timeZone, now));
  }

  const chosen = next ?? new Date(now.getTime() + SAFETY_CHECK_MINUTES * MINUTE);
  const soonest = new Date(now.getTime() + MIN_WAIT_MINUTES * MINUTE);
  return chosen < soonest ? soonest : chosen;
}

/** When to try again after a failed delivery, as a separate time so retries can be capped. */
export function deliveryRetryAt(now: Date) {
  return new Date(now.getTime() + DELIVERY_RETRY_MINUTES * MINUTE);
}
