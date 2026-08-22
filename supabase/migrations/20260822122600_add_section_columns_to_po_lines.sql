-- Migration to add section and sub_section columns to purchase_order_lines table
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS sub_section TEXT;
