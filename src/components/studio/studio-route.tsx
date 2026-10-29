import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import StudioApp, { StudioLoading } from "@/components/studio/studio-app";
import OfflineRecovery from "@/components/studio/offline-recovery";
import { AuthSetupNotice } from "@/components/auth/auth-form";
import { auth, isAuthConfigured } from "@/lib/auth";

export default function StudioRoute({
  initialSummaryMonth,
}: {
  initialSummaryMonth?: string | null;
}) {
  return (
    <Suspense fallback={<StudioLoading />}>
      <ProtectedStudio initialSummaryMonth={initialSummaryMonth} />
    </Suspense>
  );
}

async function ProtectedStudio({
  initialSummaryMonth,
}: {
  initialSummaryMonth?: string | null;
}) {
  if (!isAuthConfigured) return <AuthSetupNotice />;

  let session;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    return <OfflineRecovery />;
  }
  if (!session) redirect("/sign-in");

  return (
    <StudioApp
      userId={session.user.id}
      initialUserName={session.user.name}
      initialSummaryMonth={initialSummaryMonth}
    />
  );
}
