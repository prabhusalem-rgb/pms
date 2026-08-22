-- Migration to add delivery_note_number to goods_receipt_notes table
ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS delivery_note_number VARCHAR(100);
