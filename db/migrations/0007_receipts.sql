CREATE TABLE IF NOT EXISTS receipt_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  logo_url text,
  brand_color text NOT NULL DEFAULT '#B3273A' CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  address text,
  phone text,
  instagram text,
  tiktok text,
  facebook text,
  x_handle text,
  whatsapp text,
  next_number integer NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  number integer NOT NULL CHECK (number >= 1),
  received_from text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_for text NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('transfer', 'cash', 'cheque', 'pos', 'other')),
  receipt_date date NOT NULL,
  -- Brand name, logo, colour and contact details as they were when the receipt
  -- was issued, so changing settings later never alters an issued receipt.
  branding jsonb NOT NULL,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, number)
);

CREATE INDEX IF NOT EXISTS receipts_business_order_idx ON receipts(business_id, order_id);
