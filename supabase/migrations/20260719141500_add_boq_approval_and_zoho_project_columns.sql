-- Add BOQ approval and Zoho project mapping columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boq_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boq_approved_by VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS boq_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS zoho_project_id VARCHAR(100);

-- Add frozen quantity and rate columns to boq_items table
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS frozen_qty NUMERIC(15, 3);
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS frozen_rate NUMERIC(15, 3);

-- Add unit column to purchase_order_lines table
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS unit VARCHAR(20);
