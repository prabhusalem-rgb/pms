-- Migration to add creation_mode to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS creation_mode VARCHAR(20) DEFAULT 'item';
