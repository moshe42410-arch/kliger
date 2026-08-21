-- Contacts (email recipients) + Drive metadata on client_documents

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner_name
  ON contacts (owner_id, name);

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS drive_web_view_link TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_documents_drive_file
  ON client_documents (client_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;
