import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { db } from "@/lib/db";

export type StudioPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: "test" | "order_status" | "due_soon" | "due_today" | "overdue" | "daily_digest";
};

type StoredPushSubscription = WebPushSubscription & { user_agent?: string | null };

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const fallbackVapidSubject = "https://studio-tau-eight-46.vercel.app";
const configuredVapidSubject = process.env.VAPID_SUBJECT?.trim();
const vapidSubject = configuredVapidSubject?.startsWith("https://") ? configuredVapidSubject : fallbackVapidSubject;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function isPushConfigured() {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

export async function savePushSubscription(userId: string, subscription: StoredPushSubscription) {
  if (!db) throw new Error("Push storage is not configured yet.");
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = now()`,
    [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.user_agent ?? null],
  );
}

export async function removePushSubscription(userId: string, endpoint: string) {
  if (!db) throw new Error("Push storage is not configured yet.");
  await db.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]);
}

export async function sendPushToUser(userId: string, payload: StudioPushPayload) {
  if (!db) return { configured: false, sent: 0, removed: 0, failed: 0 };
  if (!isPushConfigured()) return { configured: false, sent: 0, removed: 0, failed: 0 };

  const subscriptions = await db.query<StoredPushSubscription>(
    "SELECT endpoint, p256dh, auth, user_agent FROM push_subscriptions WHERE user_id = $1",
    [userId],
  );
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const subscription of subscriptions.rows) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: payload.kind === "overdue" ? "high" : "normal",
        timeout: 5_000,
      });
      await db.query("UPDATE push_subscriptions SET last_success_at = now(), updated_at = now() WHERE endpoint = $1", [subscription.endpoint]);
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : undefined;
      const reason = typeof error === "object" && error !== null && "body" in error
        ? String(error.body).slice(0, 200)
        : error instanceof Error
          ? error.message
          : "Unknown push provider error";
      console.error("[push] delivery failed", { statusCode, reason });
      if (statusCode === 404 || statusCode === 410) {
        await db.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [subscription.endpoint]);
        removed += 1;
      } else {
        await db.query("UPDATE push_subscriptions SET last_failure_at = now(), updated_at = now() WHERE endpoint = $1", [subscription.endpoint]);
        failed += 1;
      }
    }
  }

  return { configured: true, sent, removed, failed };
}
