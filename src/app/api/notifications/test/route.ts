import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { NOTIFICATIONS_PAUSED_MESSAGE, notificationsPaused } from "@/lib/notifications-pause";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

export async function POST() {
  // Before the session lookup, which itself needs the database.
  if (notificationsPaused()) return NextResponse.json({ error: NOTIFICATIONS_PAUSED_MESSAGE, paused: true }, { status: 503 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to test notifications." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.pushTest);
  if (limited) return limited;
  if (!isPushConfigured()) return NextResponse.json({ error: "Push notifications are not configured on the server yet." }, { status: 503 });

  try {
    const result = await sendPushToUser(session.user.id, {
      title: "Studio is ready to help",
      body: "Push notifications are working. Studio will remind you what order needs attention.",
      url: "/",
      tag: "studio-test",
      kind: "test",
    });
    if (result.sent === 0 && result.failed > 0) {
      return NextResponse.json(
        { error: "A notification device was found, but delivery failed. Turn notifications off and on again, then retry." },
        { status: 503 },
      );
    }
    if (result.sent === 0) return NextResponse.json({ error: "No active notification devices were found. Turn notifications on for this device, then retry." }, { status: 404 });
    return NextResponse.json({ ok: true, sent: result.sent });
  } catch {
    return NextResponse.json({ error: "The test notification could not be sent." }, { status: 503 });
  }
}
