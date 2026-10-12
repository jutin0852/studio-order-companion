import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import StudioApp, { StudioLoading } from "@/components/studio/studio-app";
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

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <StudioApp
      userId={session.user.id}
      initialUserName={session.user.name}
      initialSummaryMonth={initialSummaryMonth}
    />
  );
}
