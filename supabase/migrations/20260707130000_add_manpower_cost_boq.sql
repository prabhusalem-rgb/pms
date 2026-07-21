-- Add is_manpower_cost flag to internal BOQ items
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS is_manpower_cost BOOLEAN DEFAULT FALSE;

-- Junction table to link one internal manpower item to multiple client BOQ items
CREATE TABLE IF NOT EXISTS internal_manpower_client_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_boq_item_id UUID REFERENCES boq_items(id) ON DELETE CASCADE,
    client_boq_item_id UUID REFERENCES client_boq_items(id) ON DELETE CASCADE,
    allocation_weight NUMERIC(5, 2) DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(internal_boq_item_id, client_boq_item_id)
);
