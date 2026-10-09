import { NextResponse } from "next/server";
import { processDueNotifications } from "@/lib/notifications";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  try {
    return NextResponse.json(await processDueNotifications());
  } catch {
    return NextResponse.json({ error: "The notification processor failed." }, { status: 503 });
  }
}
