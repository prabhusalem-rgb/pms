-- Migration to add client_boq_sub_section to boq_items table
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS client_boq_sub_section VARCHAR(100);
