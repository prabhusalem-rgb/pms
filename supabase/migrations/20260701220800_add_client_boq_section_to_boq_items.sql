-- Migration to add client_boq_section to boq_items
ALTER TABLE boq_items ADD COLUMN client_boq_section VARCHAR(100);
