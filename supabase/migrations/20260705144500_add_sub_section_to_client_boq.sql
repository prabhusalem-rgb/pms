-- Add sub_section to client_boq_items table
ALTER TABLE client_boq_items ADD COLUMN IF NOT EXISTS sub_section VARCHAR(100) DEFAULT 'General';
