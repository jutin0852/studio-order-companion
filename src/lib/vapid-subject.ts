// Apple's push service rejects non-https VAPID subjects (e.g. mailto:), so only
// https values are usable. Prefer an explicit VAPID_SUBJECT, then the app's own
// public URL; return null rather than inventing a host.
export function resolveVapidSubject(env: Record<string, string | undefined>) {
  for (const candidate of [env.VAPID_SUBJECT, env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.origin;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}
