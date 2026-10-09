CREATE TABLE IF NOT EXISTS order_snoozes (
  order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  snoozed_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_snoozes_business_id_idx ON order_snoozes(business_id);
