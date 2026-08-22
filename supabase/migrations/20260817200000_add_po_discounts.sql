-- Add discount_before_vat, discount_after_vat, and their respective types to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_before_vat NUMERIC(15, 3) DEFAULT 0.000;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_before_vat_type VARCHAR(20) DEFAULT 'amount';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_after_vat NUMERIC(15, 3) DEFAULT 0.000;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount_after_vat_type VARCHAR(20) DEFAULT 'amount';
