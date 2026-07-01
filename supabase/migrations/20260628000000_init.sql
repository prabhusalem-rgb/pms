-- Oman-compliant Construction PMS Database Schema
-- Standard VAT is 5%, Currency is OMR (Rial Omani)

-- 1. Projects Setup
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    client VARCHAR(255),
    consultant VARCHAR(255),
    site_location VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'OMR',
    vat_rate NUMERIC(5, 2) DEFAULT 5.00, -- Default standard VAT is 5% in Oman
    tin_number VARCHAR(50), -- Tax Identification Number
    vat_number VARCHAR(50), -- VAT Registration Number
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BOQ (Bill of Quantities) Items
CREATE TABLE IF NOT EXISTS boq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    item_code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    planned_qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    approved_qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    unit_rate NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    vat_rate NUMERIC(5, 2) DEFAULT 5.00,
    subtotal NUMERIC(15, 3) GENERATED ALWAYS AS (approved_qty * unit_rate) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Suppliers & Subcontractors
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('Material Supplier', 'Subcontractor')),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    tin_number VARCHAR(50),
    vat_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_received', 'closed')),
    type VARCHAR(50) DEFAULT 'material' CHECK (type IN ('material', 'subcontract')),
    retention_percent NUMERIC(5, 2) DEFAULT 0.00, -- Milestone retention % for subcontractors
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Purchase Order Lines
CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    qty NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    unit_rate NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    vat_rate NUMERIC(5, 2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Goods Receipt Notes (GRN) for Site Receipt
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(100) UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    received_date DATE DEFAULT CURRENT_DATE,
    received_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Goods Receipt Note Lines
CREATE TABLE IF NOT EXISTS grn_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    po_line_id UUID REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
    qty_received NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Material Issue Notes (Stock Consumption)
CREATE TABLE IF NOT EXISTS material_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number VARCHAR(100) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    issue_date DATE DEFAULT CURRENT_DATE,
    issued_to_location VARCHAR(255) NOT NULL, -- e.g., Activity / Work site location
    issued_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Material Issue Lines
CREATE TABLE IF NOT EXISTS issue_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES material_issues(id) ON DELETE CASCADE,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE SET NULL,
    qty_issued NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    qty_wastage NUMERIC(15, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Stock Ledger (for real-time stock balance calculation)
CREATE TABLE IF NOT EXISTS stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    boq_item_id UUID REFERENCES boq_items(id) ON DELETE CASCADE,
    txn_type VARCHAR(50) CHECK (txn_type IN ('receipt', 'issue')),
    ref_id UUID NOT NULL, -- Can point to grn_lines.id or issue_lines.id
    qty NUMERIC(15, 3) NOT NULL,
    unit_cost NUMERIC(15, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. VAT Transactions (for tax compliance auditing and reporting)
CREATE TABLE IF NOT EXISTS vat_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    txn_type VARCHAR(50) CHECK (txn_type IN ('PO', 'GRN', 'Milestone Invoice')),
    ref_id UUID NOT NULL,
    taxable_amount NUMERIC(15, 3) NOT NULL,
    vat_rate NUMERIC(5, 2) DEFAULT 5.00,
    vat_amount NUMERIC(15, 3) GENERATED ALWAYS AS (taxable_amount * (vat_rate / 100)) STORED,
    total_amount NUMERIC(15, 3) GENERATED ALWAYS AS (taxable_amount + (taxable_amount * (vat_rate / 100))) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
