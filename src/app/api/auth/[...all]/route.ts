import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth, isAuthConfigured } from "@/lib/auth";

const handlers = toNextJsHandler(auth);
const unavailable = () => NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

export async function GET(request: Request) {
  return isAuthConfigured ? handlers.GET(request) : unavailable();
}

export async function POST(request: Request) {
  return isAuthConfigured ? handlers.POST(request) : unavailable();
}

export async function PATCH(request: Request) {
  return isAuthConfigured ? handlers.PATCH(request) : unavailable();
}

export async function PUT(request: Request) {
  return isAuthConfigured ? handlers.PUT(request) : unavailable();
}

export async function DELETE(request: Request) {
  return isAuthConfigured ? handlers.DELETE(request) : unavailable();
}
