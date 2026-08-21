-- =============================================================================
-- KLIGER - Postgres Schema (for Neon / Vercel Postgres)
-- =============================================================================
-- Run this ONCE in Neon Console SQL Editor before first deployment.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'advisor',
  active INTEGER NOT NULL DEFAULT 1,
  phone TEXT,
  company_name TEXT,
  logo_filename TEXT,
  dashboard_cards TEXT,
  gmail_email TEXT,
  gmail_refresh_token TEXT,
  gmail_access_token TEXT,
  gmail_token_expiry TEXT,
  gmail_connected_at TEXT,
  email_templates TEXT,
  auto_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emails TEXT NOT NULL DEFAULT '[]',
  phones TEXT NOT NULL DEFAULT '[]',
  reminder_channel TEXT NOT NULL DEFAULT 'email',
  notes TEXT,
  case_type TEXT,
  bank TEXT,
  required_amount DOUBLE PRECISION,
  property_value DOUBLE PRECISION,
  property_address TEXT,
  existing_mortgage DOUBLE PRECISION,
  drive_folder_url TEXT,
  drive_folder_id TEXT,
  income_snapshot TEXT,
  income_snapshot_at TEXT,
  income_source_filename TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS associations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  bank_number TEXT,
  branch_number TEXT,
  account_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

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

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  association_id TEXT REFERENCES associations(id) ON DELETE SET NULL,
  deposit_type TEXT NOT NULL,
  responsibility TEXT NOT NULL DEFAULT 'client',
  amount DOUBLE PRECISION NOT NULL,
  day_of_month INTEGER NOT NULL,
  days_before_reminder INTEGER NOT NULL DEFAULT 5,
  start_date TEXT NOT NULL,
  end_date TEXT,
  reminder_recipient TEXT NOT NULL DEFAULT 'advisor',
  scholarship_delivery TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deposit_id TEXT NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting_client',
  phase TEXT NOT NULL DEFAULT 'primary',
  escalated_to_client INTEGER NOT NULL DEFAULT 0,
  target_date TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  last_sent_at TEXT,
  sends_count INTEGER NOT NULL DEFAULT 0,
  client_response TEXT,
  client_response_at TEXT,
  paid_at TEXT,
  action_done_at TEXT,
  payment_done_at TEXT,
  subject TEXT,
  body TEXT,
  upload_token TEXT UNIQUE,
  snooze_until TEXT,
  client_remind_at TEXT,
  month_bucket TEXT NOT NULL,
  carried_over INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS client_documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')),
  source TEXT NOT NULL DEFAULT 'upload',
  drive_file_id TEXT,
  drive_web_view_link TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_documents_client
  ON client_documents (client_id, uploaded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_documents_drive_file
  ON client_documents (client_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  email_status TEXT,
  email_error TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

CREATE TABLE IF NOT EXISTS email_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  reminder_id TEXT,
  client_id TEXT,
  to_addresses TEXT,
  subject TEXT,
  body TEXT,
  status TEXT,
  error TEXT,
  sent_at TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'))
);

-- ---------------------------------------------------------------------------
-- Indexes (same as SQLite version)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_associations_owner ON associations(owner_id);
CREATE INDEX IF NOT EXISTS idx_deposits_owner ON deposits(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_month ON reminders(month_bucket);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_upload_token ON reminders(upload_token);
CREATE INDEX IF NOT EXISTS idx_reminders_deposit_phase ON reminders(deposit_id, phase);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_deposit_target_phase ON reminders(deposit_id, target_date, phase);
CREATE INDEX IF NOT EXISTS idx_deposits_client ON deposits(client_id);
CREATE INDEX IF NOT EXISTS idx_deposits_active ON deposits(active);
CREATE INDEX IF NOT EXISTS idx_messages_reminder ON messages(reminder_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
