const appUrl = process.env.NOTIFICATIONS_APP_URL ?? process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const cronSecret = process.env.CRON_SECRET;

if (!appUrl || !cronSecret) throw new Error("NOTIFICATIONS_APP_URL (or BETTER_AUTH_URL) and CRON_SECRET are required.");

const response = await fetch(new URL("/api/notifications/process", appUrl), {
  method: "POST",
  headers: { "x-cron-secret": cronSecret },
});

const body = await response.text();
if (!response.ok) throw new Error(`Notification processor failed (${response.status}): ${body}`);
console.log(body);
