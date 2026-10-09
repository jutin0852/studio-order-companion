import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { sendAuthEmail } from "@/lib/auth-email";
import { db, ensureUserWorkspace } from "@/lib/db";

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010";
const configuredAllowedHosts = process.env.BETTER_AUTH_ALLOWED_HOSTS
  ?.split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const allowedHosts = Array.from(
  new Set([
    new URL(appUrl).host,
    "localhost:3010",
    "127.0.0.1:3010",
    "192.168.1.3:3010",
    "192.168.1.3.nip.io:3010",
    ...(configuredAllowedHosts ?? []),
  ]),
);
const dynamicBaseUrl = {
  allowedHosts,
  fallback: appUrl,
  protocol: "auto" as const,
};
const databaseUrl = process.env.DATABASE_URL;
const configuredAuthSecret = process.env.BETTER_AUTH_SECRET;
const authSecret = configuredAuthSecret ?? randomBytes(32).toString("hex");
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleConfig = googleClientId && googleClientSecret
  ? { clientId: googleClientId, clientSecret: googleClientSecret }
  : undefined;

const database = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 5,
      ssl: databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
    })
  : undefined;

export const isAuthConfigured = Boolean(databaseUrl && configuredAuthSecret);
export const isGoogleAuthConfigured = Boolean(googleConfig);

export const auth = betterAuth({
  appName: "Studio",
  baseURL: dynamicBaseUrl,
  secret: authSecret ?? "studio-auth-not-configured",
  database,
  trustedOrigins: [appUrl, ...allowedHosts.map((host) => `http://${host}`)],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (db) await ensureUserWorkspace(user.id, user.name);
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      void sendAuthEmail({
        to: user.email,
        subject: "Reset your Studio password",
        text: `Reset your Studio password here: ${url}`,
        html: `<p>Reset your Studio password by <a href="${url}">opening this secure link</a>.</p>`,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },
  ...(googleConfig
    ? {
        socialProviders: {
          google: googleConfig,
        },
      }
    : {}),
});

export type AuthSession = typeof auth.$Infer.Session;
