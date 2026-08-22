-- Migration: Add sort_order column to boq_items and client_boq_items
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE client_boq_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
