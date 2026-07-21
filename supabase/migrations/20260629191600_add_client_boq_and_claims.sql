-- Client BOQ Items
CREATE TABLE IF NOT EXISTS client_boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    item_code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    value NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Map Internal BOQ Items to Client BOQ Items
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS client_boq_item_id UUID REFERENCES client_boq_items(id) ON DELETE SET NULL;

-- Client Claims
CREATE TABLE IF NOT EXISTS client_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Client Claim Lines
CREATE TABLE IF NOT EXISTS client_claim_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID REFERENCES client_claims(id) ON DELETE CASCADE,
    client_boq_item_id UUID REFERENCES client_boq_items(id) ON DELETE CASCADE,
    claim_amount NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
