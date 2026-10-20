-- A reminder is claimed briefly while its push is being sent, so the database
-- connection does not have to stay open for the network call. A claim that is
-- never released (crashed worker) expires and the reminder can be retried.
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
