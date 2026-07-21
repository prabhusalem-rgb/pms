-- Add Zoho columns to existing tables
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS zoho_contact_id VARCHAR(100);
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS zoho_item_id VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS zoho_po_id VARCHAR(100);

-- Create Zoho Integration Settings Table
CREATE TABLE IF NOT EXISTS zoho_integration_settings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'current_zoho_config',
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    region VARCHAR(50) DEFAULT 'com',
    access_token TEXT,
    refresh_token TEXT,
    expiry_time BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disable Row Level Security (RLS) to allow system updates
ALTER TABLE zoho_integration_settings DISABLE ROW LEVEL SECURITY;
