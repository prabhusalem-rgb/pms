-- Update CHECK constraint on suppliers table to allow 'Both' type
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_type_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_type_check CHECK (type IN ('Material Supplier', 'Subcontractor', 'Both'));
