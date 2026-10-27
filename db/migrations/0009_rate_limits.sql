-- Better Auth's own rate limiter (sign-in, sign-up, password reset), stored in
-- the database so limits hold across serverless instances. Names and columns
-- match what Better Auth expects for its `rateLimit` model.
CREATE TABLE IF NOT EXISTS "rateLimit" (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

-- Per-user limits for Studio's own API routes, counted in fixed time windows.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_window_idx ON api_rate_limits (window_start);
