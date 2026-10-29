// Kill switch for every automatic and manual notification. It is read before any
// database query or push delivery, so a paused Studio never touches the database
// for notifications (which matters while the database is unavailable).
//
// Notifications are paused unless STUDIO_NOTIFICATIONS_PAUSED is explicitly set
// to "false". There is deliberately no "paused until" date: a date would turn
// notifications back on by itself, and they should only resume once the database
// has been confirmed reachable. See docs/notifications-pause.md.

type PauseEnv = Record<string, string | undefined>;

export const NOTIFICATIONS_PAUSED_MESSAGE =
  "Notifications are temporarily paused while Studio's database recovers. Your reminder settings are saved and will start working again once it is back.";

export function notificationsPaused(env: PauseEnv = process.env) {
  return env.STUDIO_NOTIFICATIONS_PAUSED?.trim().toLowerCase() !== "false";
}
