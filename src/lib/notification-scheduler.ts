import { after } from "next/server";
import { notificationsPaused } from "@/lib/notifications-pause";

/**
 * Tells the scheduler Worker that something affecting notification times has
 * changed, so it recalculates instead of waiting for its next alarm. Runs after
 * the response is sent, and a failure never affects the save that triggered it.
 */
export function rescheduleNotifications() {
  const schedulerUrl = process.env.NOTIFICATIONS_SCHEDULER_URL;
  const secret = process.env.CRON_SECRET;
  if (notificationsPaused() || !schedulerUrl || !secret) return;

  after(async () => {
    try {
      const response = await fetch(new URL("/reschedule", schedulerUrl), {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) console.error("[notifications] the scheduler refused the reschedule", { status: response.status });
    } catch {
      console.error("[notifications] the scheduler could not be reached");
    }
  });
}
