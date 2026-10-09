CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My business',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  working_days smallint NOT NULL DEFAULT 5 CHECK (working_days BETWEEN 1 AND 31),
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  reminder_time time NOT NULL DEFAULT '09:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  due_today_enabled boolean NOT NULL DEFAULT true,
  due_soon_enabled boolean NOT NULL DEFAULT true,
  overdue_enabled boolean NOT NULL DEFAULT true,
  daily_digest_enabled boolean NOT NULL DEFAULT false,
  reminder_time time NOT NULL DEFAULT '09:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12, 2) NOT NULL CHECK (price > 0),
  lead_time_days smallint NOT NULL DEFAULT 5 CHECK (lead_time_days > 0),
  image_url text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  customer_name text NOT NULL,
  amount_paid numeric(12, 2) NOT NULL CHECK (amount_paid > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'ready', 'delivered')),
  notes text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  occurred_on date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('due_soon', 'due_today', 'overdue', 'daily_digest')),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  snoozed_until timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'snoozed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS businesses_owner_user_id_idx ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS products_business_id_idx ON products(business_id);
CREATE INDEX IF NOT EXISTS orders_business_id_created_at_idx ON orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_business_id_due_date_idx ON orders(business_id, due_date);
CREATE INDEX IF NOT EXISTS expenses_business_id_occurred_on_idx ON expenses(business_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS reminders_pending_idx ON reminders(status, scheduled_for);

INSERT INTO businesses (owner_user_id)
SELECT id FROM "user"
ON CONFLICT (owner_user_id) DO NOTHING;

INSERT INTO business_settings (business_id)
SELECT id FROM businesses
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO notification_preferences (user_id)
SELECT owner_user_id FROM businesses
ON CONFLICT (user_id) DO NOTHING;
