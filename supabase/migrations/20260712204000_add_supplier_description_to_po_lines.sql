-- Add supplier_description column to purchase_order_lines
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS supplier_description TEXT;
