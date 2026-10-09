ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_request_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_business_client_request_id_key'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_business_client_request_id_key
      UNIQUE (business_id, client_request_id);
  END IF;
END $$;
