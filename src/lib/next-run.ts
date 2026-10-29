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
 * The longest the scheduler may go without calling the app. Changes made in
 * between (a new reminder time, a new order) are picked up by this check.
 */
export const SAFETY_CHECK_MINUTES = 60;
/** How soon to retry when a notification could not be delivered. */
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

function earliest(current: Date, candidate: Date | null) {
  return candidate && candidate < current ? candidate : current;
}

// A reminder fires once its time has passed, so the next one is today at the
// reminder time if that is still ahead, otherwise tomorrow.
function nextReminder(row: NextRunRow, timeZone: string, now: Date) {
  const reminderMinutes = minutesFromTime(row.reminder_time) ?? 9 * 60;
  const today = localDateKey(now, timeZone);
  const date = reminderMinutes > localMinutes(now, timeZone) ? today : nextDateKey(today);
  return zonedTimeToDate(date, reminderMinutes, timeZone);
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
 * When the scheduler should next call the processor: the earliest of every
 * user's next reminder and next random check-in, and the safety check. Users
 * with notifications off are ignored. Never earlier than a minute from now and
 * never later than the safety check, so a stale answer cannot sleep for long.
 */
export function nextRunAt(rows: NextRunRow[], now: Date, options: { retrySoon?: boolean } = {}) {
  let next = new Date(now.getTime() + SAFETY_CHECK_MINUTES * MINUTE);
  if (options.retrySoon) next = earliest(next, new Date(now.getTime() + DELIVERY_RETRY_MINUTES * MINUTE));

  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.push_enabled || seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const timeZone = validTimeZoneOrDefault(row.timezone);
    next = earliest(next, nextReminder(row, timeZone, now));
    if (row.random_alerts_enabled) next = earliest(next, nextRandomAlert(row, timeZone, now));
  }

  const soonest = new Date(now.getTime() + MIN_WAIT_MINUTES * MINUTE);
  return next < soonest ? soonest : next;
}
