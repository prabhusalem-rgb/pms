-- Add section column to boq_items table
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT 'General Works';
