-- Migration: Add amount_received column to grn_lines for value-based booking of subcontracts
ALTER TABLE grn_lines ADD COLUMN IF NOT EXISTS amount_received NUMERIC(15, 3) DEFAULT 0.000;
