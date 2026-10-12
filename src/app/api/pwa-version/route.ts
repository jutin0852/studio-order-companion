import { connection } from "next/server";

export async function GET() {
  // Cache Components requires an explicit runtime boundary for dynamic routes.
  await connection();

  // Vercel supplies a distinct deployment ID for every release. The stable
  // local fallback avoids creating a new worker on every development refresh.
  const version =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "local";

  return new Response(`self.__STUDIO_PWA_VERSION = ${JSON.stringify(version)};`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}
