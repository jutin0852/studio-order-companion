-- Random order nudges: a few alerts a day at unpredictable times while the owner
-- is awake. On by default; owners can turn them off or change how many arrive.
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS random_alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS random_alerts_per_day smallint NOT NULL DEFAULT 3
    CHECK (random_alerts_per_day BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS awake_start time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS awake_end time NOT NULL DEFAULT '21:00';

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_kind_check;
ALTER TABLE reminders
  ADD CONSTRAINT reminders_kind_check
  CHECK (kind IN ('due_soon', 'due_today', 'overdue', 'daily_digest', 'stalled', 'random_nudge'));
