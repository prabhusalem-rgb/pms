-- Add unit column to purchase_order_lines table
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS unit VARCHAR(20);
