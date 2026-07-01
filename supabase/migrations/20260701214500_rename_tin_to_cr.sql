-- Rename tin_number column to cr_number in projects table
ALTER TABLE projects RENAME COLUMN tin_number TO cr_number;

-- Rename tin_number column to cr_number in suppliers table
ALTER TABLE suppliers RENAME COLUMN tin_number TO cr_number;

-- Rename tin_number column to cr_number in company_details table
ALTER TABLE company_details RENAME COLUMN tin_number TO cr_number;
