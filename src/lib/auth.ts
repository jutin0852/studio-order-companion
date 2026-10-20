import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { buildAllowedHosts, resolveAuthSecret } from "@/lib/auth-config";
import { sendAuthEmail } from "@/lib/auth-email";
import { db, ensureUserWorkspace } from "@/lib/db";

const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3010";
const allowedHosts = buildAllowedHosts(process.env, appUrl);
const dynamicBaseUrl = {
  allowedHosts,
  fallback: appUrl,
  protocol: "auto" as const,
};
const authSecret = resolveAuthSecret(process.env);
if (!authSecret.configured) console.error(`[auth] Authentication is disabled. ${authSecret.reason}`);
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleConfig = googleClientId && googleClientSecret
  ? { clientId: googleClientId, clientSecret: googleClientSecret }
  : undefined;

export const isAuthConfigured = Boolean(db && authSecret.configured);
export const isGoogleAuthConfigured = Boolean(googleConfig);

export const auth = betterAuth({
  appName: "Studio",
  baseURL: dynamicBaseUrl,
  // When unconfigured, a throwaway secret keeps Better Auth constructible; no
  // session can validate against it and the auth routes answer 503.
  secret: authSecret.secret ?? randomBytes(32).toString("hex"),
  // Share the application pool with Better Auth so session lookup and app
  // persistence do not create separate Neon connection pools.
  database: db ?? undefined,
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
      await sendAuthEmail({
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
