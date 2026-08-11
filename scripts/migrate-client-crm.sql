-- KLIGER: Client CRM + dual tracking reminders
-- Safe to re-run (IF NOT EXISTS / defaults).

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_reminders_enabled INTEGER NOT NULL DEFAULT 1;

-- clients: case background + drive stub + income snapshot
ALTER TABLE clients ADD COLUMN IF NOT EXISTS case_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bank TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS required_amount DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS property_value DOUBLE PRECISION;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS income_snapshot TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS income_snapshot_at TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS income_source_filename TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_phone TEXT;

-- deposits: scholarship delivery mode
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS scholarship_delivery TEXT;

-- reminders: dual tracking
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS action_done_at TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS payment_done_at TEXT;
