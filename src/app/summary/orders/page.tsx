import { Suspense } from "react";
import StudioRoute from "@/components/studio/studio-route";
import { StudioLoading } from "@/components/studio/studio-app";

type SummaryOrderHistoryPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function SummaryOrderHistoryPage({
  searchParams,
}: SummaryOrderHistoryPageProps) {
  return (
    <Suspense fallback={<StudioLoading />}>
      <ResolvedSummaryOrderHistoryPage searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolvedSummaryOrderHistoryPage({
  searchParams,
}: SummaryOrderHistoryPageProps) {
  const requestedMonth = (await searchParams).month;
  const initialSummaryMonth =
    typeof requestedMonth === "string" && /^\d{4}-\d{2}$/.test(requestedMonth)
      ? requestedMonth
      : null;
  return <StudioRoute initialSummaryMonth={initialSummaryMonth} />;
}
