import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPushConfigured, sendPushToUser } from "@/lib/push";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "You must be signed in to test notifications." }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "Push notifications are not configured on the server yet." }, { status: 503 });

  try {
    const result = await sendPushToUser(session.user.id, {
      title: "Studio is ready to help",
      body: "Push notifications are working. Studio will remind you what order needs attention.",
      url: "/",
      tag: "studio-test",
      kind: "test",
    });
    if (result.sent === 0) return NextResponse.json({ error: "No active notification devices were found." }, { status: 404 });
    return NextResponse.json({ ok: true, sent: result.sent });
  } catch {
    return NextResponse.json({ error: "The test notification could not be sent." }, { status: 503 });
  }
}
