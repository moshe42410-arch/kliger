-- Add client national ID (מ.ז)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS national_id TEXT;
