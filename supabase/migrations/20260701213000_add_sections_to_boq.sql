-- Add sub_section to boq_items table
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS sub_section VARCHAR(100) DEFAULT 'General';

-- Add section to client_boq_items table
ALTER TABLE client_boq_items ADD COLUMN IF NOT EXISTS section VARCHAR(100) DEFAULT 'General';
ALTER TABLE client_boq_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'LS';
ALTER TABLE client_boq_items ADD COLUMN IF NOT EXISTS qty NUMERIC(15, 3) DEFAULT 1.000;
