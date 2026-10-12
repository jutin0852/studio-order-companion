ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS attention_days_before smallint NOT NULL DEFAULT 3
    CHECK (attention_days_before BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS due_soon_days_before integer[] NOT NULL DEFAULT ARRAY[3, 2]::integer[]
    CHECK (
      cardinality(due_soon_days_before) <= 10
      AND 1 <= ALL (due_soon_days_before)
      AND 30 >= ALL (due_soon_days_before)
    ),
  ADD COLUMN IF NOT EXISTS overdue_grace_days smallint NOT NULL DEFAULT 0
    CHECK (overdue_grace_days BETWEEN 0 AND 14),
  ADD COLUMN IF NOT EXISTS overdue_repeat_days smallint NOT NULL DEFAULT 1
    CHECK (overdue_repeat_days BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS stalled_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stalled_after_days smallint NOT NULL DEFAULT 2
    CHECK (stalled_after_days BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS stalled_repeat_days smallint NOT NULL DEFAULT 2
    CHECK (stalled_repeat_days BETWEEN 1 AND 30);

ALTER TABLE reminders DROP CONSTRAINT IF EXISTS reminders_kind_check;
ALTER TABLE reminders
  ADD CONSTRAINT reminders_kind_check
  CHECK (kind IN ('due_soon', 'due_today', 'overdue', 'daily_digest', 'stalled'));
