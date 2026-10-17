# Audit fix plan

Findings from the app audit, ordered by priority. Each item lists the problem, the fix, files, tests and rollout risk.
Suggested delivery: one PR per group (A: auth/config, B: input validation, C: data integrity, D: reliability, E: hygiene).

## Prerequisite: working toolchain
- `npm install`, then confirm `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` all pass on a clean tree. Only the tests have been run so far.
- Add `typecheck` (`tsc --noEmit`) to `package.json` scripts.

## A. Auth and configuration

### A1. Random auth secret fallback — `src/lib/auth.ts:25`
**Problem:** without `BETTER_AUTH_SECRET` a random secret is generated per process. On serverless each instance differs, so sessions fail intermittently. `isAuthConfigured` guards only the auth route, not `auth.api.getSession` calls elsewhere.
**Fix:**
1. In production (`NODE_ENV === "production"`) throw at module load if the secret is missing or shorter than 32 chars.
2. In development keep a fixed, clearly named dev-only secret (not random) so restarts keep sessions.
3. Remove the dead `?? "studio-auth-not-configured"` fallback.
**Tests:** unit test for a small `resolveAuthSecret(env)` helper (prod+missing throws, prod+short throws, dev returns fixed value, valid passes).
**Risk:** a deploy lacking the secret will now fail at startup. Verify it is set in Vercel before merging.

### A2. Hardcoded LAN hosts in trusted origins — `src/lib/auth.ts:10-17`
**Problem:** `192.168.1.3` and `192.168.1.3.nip.io` are trusted in every environment. `nip.io` resolves to any IP, so it widens the origin allowlist in production.
**Fix:** extract `buildAllowedHosts(env)`. Include the dev hosts only when `NODE_ENV !== "production"`; in production use `appUrl` host plus `BETTER_AUTH_ALLOWED_HOSTS`. Mirror this in `next.config.ts` `allowedDevOrigins` (dev only already).
**Tests:** unit test for both modes.
**Risk:** phone testing on the LAN in dev keeps working; confirm `.env.local` still lists the hosts.

## B. Input validation

### B1. Image URL validation — products `route.ts:25`, `products/[id]/route.ts:25`, `business-profile/route.ts:54`
**Problem:** only checks the `https://` prefix, so any host is accepted.
**Fix:**
1. Add `src/lib/image-url.ts` exporting `isStudioImageUrl(value, cloudName)`: parse with `new URL`, require `https:`, hostname `res.cloudinary.com`, no credentials/port, path starting `/<cloudName>/image/upload/`, length <= 2000.
2. Use it in all three routes (replaces three copies).
3. Decide on existing rows: run a one-off query for `image_url`/`logo_url` not matching and either null them or leave and only validate on write (recommended: validate on write, report count).
**Tests:** valid Cloudinary URL, other host, `http:`, `user@host`, `res.cloudinary.com.evil.com`, wrong cloud name, over-length.
**Risk:** low. Check that no legitimate non-Cloudinary images are stored first.

### B2. Field length limits
**Problem:** order routes cap nothing (customer, product, notes); products cap name only.
**Fix:** shared limits (customer/product <= 160, notes <= 2000) enforced in `orders/route.ts` POST and `orders/[id]/route.ts` PATCH; add matching `maxLength` on form inputs.
**Tests:** boundary lengths.

## C. Data integrity

### C1. Order creation upsert overwrites existing orders — `src/app/api/orders/route.ts:~96`
**Problem:** `ON CONFLICT (business_id, client_request_id) DO UPDATE` rewrites every field including `status`. A stale offline retry can revert a delivered order or discard edits made since.
**Fix:** make creation idempotent without overwriting: `DO UPDATE SET client_request_id = EXCLUDED.client_request_id RETURNING ...` (no-op update so the existing row is returned unchanged). Return 200 for a replay and 201 for a new row (detect via `xmax = 0` in RETURNING or a prior SELECT).
**Tests:** needs a DB (see E2): create, mark delivered, replay the same POST, assert status stays `delivered`.
**Risk:** a client that relied on retries to apply edits will no longer do so; edits should go through PATCH. Check `studio-app.tsx` sync queue for this assumption before changing.

### C2. Snooze `ON CONFLICT` reassigns `business_id` — `orders/[id]/snooze/route.ts`
Minor: remove `business_id = EXCLUDED.business_id` from the update set; the ownership check already ran, and the column should never change.

## D. Reliability

### D1. DB connection held during push delivery — `src/lib/notifications.ts` `deliverReminder`
**Problem:** the transaction and advisory lock stay open while `sendPushToUser` makes network calls (up to 5s per device). The pool is `max: 5`, so a few slow sends can block every API request.
**Fix:**
1. Transaction 1: take the lock, insert/claim the reminder row (`status = 'pending'`), commit, release client.
2. Send push with no client held.
3. Transaction 2 (or a single `UPDATE`): mark `sent` on `sent > 0`.
4. To avoid double sends between steps, claim with a status transition (`pending -> sending` using `UPDATE ... WHERE status = 'pending' RETURNING`), and reset stale `sending` rows after a timeout. Confirm allowed statuses in `0001_studio_domain.sql` and add a migration if `sending` is not permitted.
**Tests:** simulate slow `sendPushToUser` and assert the pool still serves other queries; duplicate-run test for dedupe.
**Risk:** highest of the plan. Roll out alone, watch `reminders` counts for a few days.

### D2. Neon TLS verification — `src/lib/db.ts`
Replace `rejectUnauthorized: false` with default verification (`ssl: true` / `sslmode=require` in the URL). Test against the Neon connection string; Neon uses publicly trusted certificates so this should work.

### D3. Cron secret comparison — `notifications/process/route.ts`
Use `crypto.timingSafeEqual` on equal-length buffers (hash both with SHA-256 first). Same check in the worker if it compares secrets.

## E. Hygiene

### E1. Dependencies
- Move `shadcn` to `devDependencies` (CLI only). Re-run `npm audit --omit=dev`; expect the 7 highs to disappear from production scope.
- Remove the unused `cn` package if nothing imports it (`class-variance-authority` and `src/lib/utils.ts` cover this).

### E2. Test coverage
Add a Postgres-backed test setup (local Docker or a Neon test branch) and route-level tests for orders, products and snooze: auth required, cross-business access returns 404, validation errors. This unlocks C1 and D1 tests.

### E3. `studio-app.tsx` (5.8k lines)
Not part of this fix set. After A–D land, split by panel (orders, products, summary, settings) behind no behavior change, one panel per PR.

### E4. VAPID subject fallback — `src/lib/push.ts`
Remove the hardcoded Vercel URL; if `VAPID_SUBJECT` is missing or invalid, disable push and log once, as other unconfigured features do.

## Order of work
1. Prerequisite toolchain, then A1, A2, D3, D2 (small, independent).
2. B1, B2.
3. C1, C2 (after E2 test harness).
4. D1 on its own.
5. E1, E4, then E3 as follow-ups.

## Verification checklist per PR
`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, plus a manual pass: sign in, create/edit/deliver an order, add a product with an image, enable and test push.
