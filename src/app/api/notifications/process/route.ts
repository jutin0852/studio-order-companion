import { NextResponse } from "next/server";
import { processDueNotifications } from "@/lib/notifications";
import { notificationsPaused } from "@/lib/notifications-pause";
import { secretEquals } from "@/lib/secret-equals";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretEquals(suppliedSecret, configuredSecret)) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  // Answer 200 so the scheduler sees a healthy run, without touching the database.
  if (notificationsPaused()) return NextResponse.json({ paused: true, processed: 0, sent: 0, failed: 0, skipped: 0 });

  try {
    return NextResponse.json(await processDueNotifications());
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code)
        ? error.code
        : undefined;
    console.error("[notifications] automatic reminder processing failed", {
      code,
    });
    return NextResponse.json({ error: "The notification processor failed." }, { status: 503 });
  }
}
