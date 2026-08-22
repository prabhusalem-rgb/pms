-- Migration to add terms_and_conditions to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
