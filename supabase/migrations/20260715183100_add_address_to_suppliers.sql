-- Add address column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address TEXT;
