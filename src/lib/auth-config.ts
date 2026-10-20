const MIN_SECRET_LENGTH = 32;
const DEV_SECRET = "studio-development-only-secret-do-not-use-in-production";
const DEV_HOSTS = ["localhost:3010", "127.0.0.1:3010", "192.168.1.3:3010", "192.168.1.3.nip.io:3010"];

type AuthEnv = Record<string, string | undefined>;

export type AuthSecret =
  | { configured: true; secret: string }
  | { configured: false; secret: null; reason: string };

// Returns the secret to sign sessions with, or marks auth as unconfigured. An
// unconfigured state must never fall back to a guessable value in production,
// so callers keep auth disabled instead of inventing a secret.
export function resolveAuthSecret(env: AuthEnv): AuthSecret {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (env.NODE_ENV === "production") {
    if (!secret) return { configured: false, secret: null, reason: "BETTER_AUTH_SECRET is not set." };
    if (secret.length < MIN_SECRET_LENGTH) {
      return { configured: false, secret: null, reason: `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.` };
    }
    return { configured: true, secret };
  }
  // Development keeps a stable secret so restarts do not sign everyone out.
  return { configured: true, secret: secret || DEV_SECRET };
}

export function buildAllowedHosts(env: AuthEnv, appUrl: string) {
  const configured = env.BETTER_AUTH_ALLOWED_HOSTS?.split(",").map((host) => host.trim()).filter(Boolean) ?? [];
  const devHosts = env.NODE_ENV === "production" ? [] : DEV_HOSTS;
  return Array.from(new Set([new URL(appUrl).host, ...devHosts, ...configured]));
}
