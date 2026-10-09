import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { removePushSubscription, savePushSubscription } from "@/lib/push";

type SubscriptionBody = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

function isValidSubscription(body: SubscriptionBody | null): body is Required<Pick<SubscriptionBody, "endpoint" | "keys">> & SubscriptionBody {
  return Boolean(body?.endpoint?.startsWith("https://") && body.keys?.p256dh && body.keys.auth);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to enable notifications." }, { status: 401 });
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
  } catch {
    return NextResponse.json({ error: "The notification device could not be saved." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to disable notifications." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint?.startsWith("https://")) return NextResponse.json({ error: "A push endpoint is required." }, { status: 400 });

  try {
    await removePushSubscription(session.user.id, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The notification device could not be removed." }, { status: 503 });
  }
}
