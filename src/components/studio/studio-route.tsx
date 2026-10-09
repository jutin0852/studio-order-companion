import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import StudioApp, { StudioLoading } from "@/components/studio/studio-app";
import { AuthSetupNotice } from "@/components/auth/auth-form";
import { auth, isAuthConfigured } from "@/lib/auth";

export default function StudioRoute() {
  return <Suspense fallback={<StudioLoading />}><ProtectedStudio /></Suspense>;
}

async function ProtectedStudio() {
  if (!isAuthConfigured) return <AuthSetupNotice />;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return <StudioApp userId={session.user.id} initialUserName={session.user.name} />;
}
