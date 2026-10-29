import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { db } from "@/lib/db";
import { notificationsPaused } from "@/lib/notifications-pause";
import { canonicalPushEndpoint } from "@/lib/push-endpoint.mjs";
import { resolveVapidSubject } from "@/lib/vapid-subject";
export { isAllowedPushEndpoint } from "@/lib/push-endpoint.mjs";

export type StudioPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: "test" | "order_status" | "due_soon" | "due_today" | "overdue" | "stalled" | "daily_digest" | "random_nudge";
};

type IncomingPushSubscription = WebPushSubscription & { user_agent?: string | null };
type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
};

export class PushEndpointConflictError extends Error {
  constructor() {
    super("This notification device is already registered to another account.");
    this.name = "PushEndpointConflictError";
  }
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = resolveVapidSubject(process.env);
const pushEnabled = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);

if (pushEnabled && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey as string, vapidPrivateKey as string);
} else if (vapidPublicKey && vapidPrivateKey) {
  console.error("[push] Push is disabled: set VAPID_SUBJECT (or BETTER_AUTH_URL) to an https URL.");
}

export function isPushConfigured() {
  return pushEnabled;
}

export async function savePushSubscription(userId: string, subscription: IncomingPushSubscription) {
  if (!db) throw new Error("Push storage is not configured yet.");
  const endpoint = canonicalPushEndpoint(subscription.endpoint);
  if (!endpoint) throw new Error("Unsupported push service endpoint.");

  const result = await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = now()
     WHERE push_subscriptions.user_id = EXCLUDED.user_id
     RETURNING id`,
    [userId, endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.user_agent ?? null],
  );

  if (result.rowCount === 0) throw new PushEndpointConflictError();
}

export async function removePushSubscription(userId: string, endpoint: string) {
  if (!db) throw new Error("Push storage is not configured yet.");
  await db.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]);
}

export async function sendPushToUser(userId: string, payload: StudioPushPayload) {
  if (notificationsPaused()) return { configured: true, paused: true, sent: 0, removed: 0, failed: 0 };
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
    const endpoint = canonicalPushEndpoint(subscription.endpoint);
    if (!endpoint) {
      await db.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, subscription.endpoint]);
      removed += 1;
      continue;
    }

    try {
      await webpush.sendNotification({
        endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
        urgency: payload.kind === "overdue" ? "high" : "normal",
        timeout: 5_000,
      });
      await db.query("UPDATE push_subscriptions SET last_success_at = now(), updated_at = now() WHERE user_id = $1 AND endpoint = $2", [userId, subscription.endpoint]);
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
        await db.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, subscription.endpoint]);
        removed += 1;
      } else {
        await db.query("UPDATE push_subscriptions SET last_failure_at = now(), updated_at = now() WHERE user_id = $1 AND endpoint = $2", [userId, subscription.endpoint]);
        failed += 1;
      }
    }
  }

  return { configured: true, sent, removed, failed };
}
