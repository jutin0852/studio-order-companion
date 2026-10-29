// Time-zone helpers shared by the notification processor and the next-run
// calculation. No imports, so they can be tested on their own.

const DEFAULT_TIME_ZONE = "Africa/Lagos";

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

function zonedParts(at: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
}

export function validTimeZoneOrDefault(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** The local calendar date as YYYY-MM-DD. */
export function localDateKey(now: Date, timeZone: string) {
  const { year, month, day } = zonedParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Minutes since local midnight. */
export function localMinutes(now: Date, timeZone: string) {
  const { hour, minute } = zonedParts(now, timeZone);
  return hour * 60 + minute;
}

/** The calendar date after `dateKey`. */
export function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** The instant at which the wall clock in `timeZone` reads `minuteOfDay` on `dateKey`. */
export function zonedTimeToDate(dateKey: string, minuteOfDay: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  const offsetAt = (at: number) => {
    const parts = zonedParts(new Date(at), timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(at / 60_000) * 60_000;
  };
  // Two passes settle the offset when the guess lands on the other side of a DST change.
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
}
