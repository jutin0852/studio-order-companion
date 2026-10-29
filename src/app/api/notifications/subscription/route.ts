import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { NOTIFICATIONS_PAUSED_MESSAGE, notificationsPaused } from "@/lib/notifications-pause";
import { isAllowedPushEndpoint, PushEndpointConflictError, removePushSubscription, savePushSubscription } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

function isValidSubscription(body: SubscriptionBody | null): body is Required<Pick<SubscriptionBody, "endpoint" | "keys">> & SubscriptionBody {
  return Boolean(
    isAllowedPushEndpoint(body?.endpoint) &&
    typeof body?.keys?.p256dh === "string" && /^[A-Za-z0-9_-]{80,120}$/.test(body.keys.p256dh) &&
    typeof body.keys.auth === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(body.keys.auth)
  );
}

export async function POST(request: Request) {
  if (notificationsPaused()) return NextResponse.json({ error: NOTIFICATIONS_PAUSED_MESSAGE, paused: true }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to enable notifications." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  const body = await request.json().catch(() => null) as SubscriptionBody | null;
  if (!isValidSubscription(body)) return NextResponse.json({ error: "That push subscription is not valid." }, { status: 400 });

  try {
    await savePushSubscription(session.user.id, {
      endpoint: body.endpoint,
      expirationTime: body.expirationTime ?? null,
      keys: { p256dh: body.keys.p256dh as string, auth: body.keys.auth as string },
      user_agent: (await headers()).get("user-agent"),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PushEndpointConflictError) {
      return NextResponse.json({ error: "This notification device is already linked to another account." }, { status: 409 });
    }
    return NextResponse.json({ error: "The notification device could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  // Saved devices are kept untouched while paused so notifications can resume later.
  if (notificationsPaused()) return NextResponse.json({ error: NOTIFICATIONS_PAUSED_MESSAGE, paused: true }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to disable notifications." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!isAllowedPushEndpoint(body?.endpoint)) return NextResponse.json({ error: "A supported push endpoint is required." }, { status: 400 });

  try {
    await removePushSubscription(session.user.id, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The notification device could not be removed." }, { status: 503 });
  }
}
