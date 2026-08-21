-- Client documents (advisor-uploaded files for email send from case view)
CREATE TABLE IF NOT EXISTS client_documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client
  ON client_documents (client_id, uploaded_at DESC);
