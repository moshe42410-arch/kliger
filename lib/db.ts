/**
 * KLIGER Database Layer — Postgres (Neon) via @neondatabase/serverless.
 *
 * Multi-tenant SaaS: each user is an advisor. Data isolation via owner_id.
 *
 * מודל: כל משתמש הוא יועץ עצמאי (users טבלה מאוחדת שכוללת גם את
 * פרטי היועץ — שם, לוגו, שם חברה, וכו'). כל ישויות המערכת (clients,
 * deposits, reminders, ...) משויכות ל-owner_id = user.id.
 *
 * תפקידים: 'admin' (מנהל־על, יכול לפתוח משתמשים חדשים) | 'advisor' (יועץ רגיל).
 *
 * === IMPORTANT ===
 * All DB functions are ASYNC. Callers MUST await them.
 * Set DATABASE_URL environment variable (from Neon dashboard).
 */

import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

/**
 * Neon SQL helper typed as a tagged-template that always returns a row array.
 * We avoid Neon's wide ReturnType union (FullQueryResults | arrays) which
 * breaks indexing and row casts under strict TypeScript.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sql = (
  strings: TemplateStringsArray,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...values: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any[]>;

let _sql: Sql | null = null;

/**
 * Returns the singleton Neon SQL query function (tagged template).
 * Usage:
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
export function getSql(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Get your connection string from https://console.neon.tech and add it to .env.local (dev) or Vercel Environment Variables (prod)."
    );
  }
  _sql = neon(url) as unknown as Sql;
  return _sql;
}

/**
 * Backward-compat alias for pre-async code. Prefer `getSql()`.
 * @deprecated Will be removed after migration completes.
 */
export function getDb(): Sql {
  return getSql();
}

/**
 * Ensures the initial admin user exists, seeded from ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD.
 * Called lazily on first login attempt. Idempotent.
 */
export async function seedInitialAdminIfNeeded(): Promise<{
  seeded: boolean;
  email?: string;
  error?: string;
}> {
  const sql = getSql();
  const existing = (await sql`
    SELECT id FROM users WHERE role = 'admin' LIMIT 1
  `) as Array<{ id: string }>;
  if (existing[0]) return { seeded: false };

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "מנהל המערכת";

  if (!email || !password) {
    return {
      seeded: false,
      error:
        "ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD not set. Cannot seed admin.",
    };
  }

  const { v4: uuid } = await import("uuid");
  const { hashPassword } = await import("./auth-crypto");
  const id = uuid();
  const passwordHash = hashPassword(password);

  await sql`
    INSERT INTO users (id, email, name, password_hash, role, must_change_password, active)
    VALUES (${id}, ${email}, ${name}, ${passwordHash}, 'admin', 0, 1)
  `;
  console.log(`[KLIGER] נוצר admin ראשוני: ${email}`);
  return { seeded: true, email };
}

/* ---------------- Types (identical to old sync version) ---------------- */

export type ReminderChannel = "email" | "phone" | "both";
export type DepositType =
  | "salary_slip"
  | "kollel_scholarship"
  | "private_transfer"
  | "cash_check";
export type DepositResponsibility = "advisor" | "client";
export type ReminderRecipient = "advisor" | "client" | "both";
export type ReminderPhase = "primary" | "verify_payment";
export type ReminderStatus =
  | "waiting_client"
  | "waiting_advisor"
  | "waiting_association"
  | "snoozed"
  | "resolved"
  | "carried_over";
export type UserRole = "admin" | "advisor";
export type CaseType = "addition" | "purchase" | "renovation" | "expansion";
export type ScholarshipDelivery = "cash" | "transfer";

export interface IncomeLine {
  status?: string | null;
  person?: string | null;
  amount: number;
  notes?: string | null;
  role?: string | null;
}

export interface LiabilityLine {
  kind?: string | null;
  where?: string | null;
  monthly: number;
  balance?: number | null;
  endDate?: string | null;
  takenIn?: string | null;
}

export interface IncomeSnapshot {
  incomes: IncomeLine[];
  liabilities: LiabilityLine[];
  totalIncome?: number | null;
  disposable40?: number | null;
  disposable35?: number | null;
  totalLiabilitiesMonthly?: number | null;
  totalMonthlyRepayment?: number | null;
  requestedIncome35?: number | null;
  /** סכום החזר חודשי לכל 100,000 ₪ מסכום מבוקש */
  amountPer100k?: number | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  must_change_password: number;
  role: UserRole;
  active: number;
  phone: string | null;
  company_name: string | null;
  logo_filename: string | null;
  dashboard_cards: string | null;
  gmail_email: string | null;
  gmail_refresh_token: string | null;
  gmail_access_token: string | null;
  gmail_token_expiry: string | null;
  gmail_connected_at: string | null;
  email_templates: string | null;
  auto_reminders_enabled: number | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  phone: string | null;
  companyName: string | null;
  logoFilename: string | null;
  dashboardCards: string[] | null;
  gmailEmail: string | null;
  gmailConnected: boolean;
  emailTemplates: Record<string, { subject: string; body: string }> | null;
  autoRemindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function parseUser(row: UserRow): User {
  let cards: string[] | null = null;
  if (row.dashboard_cards) {
    try {
      const parsed = JSON.parse(row.dashboard_cards);
      if (Array.isArray(parsed)) cards = parsed.map(String);
    } catch {
      cards = null;
    }
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: !!row.active,
    mustChangePassword: !!row.must_change_password,
    phone: row.phone,
    companyName: row.company_name,
    logoFilename: row.logo_filename,
    dashboardCards: cards,
    gmailEmail: row.gmail_email,
    gmailConnected: !!row.gmail_refresh_token,
    emailTemplates: parseEmailTemplatesJson(row.email_templates),
    autoRemindersEnabled: row.auto_reminders_enabled == null ? true : !!row.auto_reminders_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseEmailTemplatesJson(
  raw: string | null
): Record<string, { subject: string; body: string }> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, { subject: string; body: string }>;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

/* ---------- User queries (async) ---------- */

export async function getUserById(id: string): Promise<User | null>;
// Overload: accept optional (sql, id) too for backward-compat calls like getUserById(db, id)
export async function getUserById(sql: Sql, id: string): Promise<User | null>;
export async function getUserById(
  a: string | Sql,
  b?: string
): Promise<User | null> {
  const id = typeof a === "string" ? a : (b as string);
  const sql = getSql();
  const rows = (await sql`SELECT * FROM users WHERE id = ${id}`) as UserRow[];
  return rows[0] ? parseUser(rows[0]) : null;
}

export async function getUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null>;
export async function getUserByEmail(
  sql: Sql,
  email: string
): Promise<(User & { passwordHash: string }) | null>;
export async function getUserByEmail(
  a: string | Sql,
  b?: string
): Promise<(User & { passwordHash: string }) | null> {
  const email = typeof a === "string" ? a : (b as string);
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM users WHERE lower(email) = lower(${email.trim()})
  `) as UserRow[];
  const row = rows[0];
  if (!row) return null;
  return { ...parseUser(row), passwordHash: row.password_hash };
}

export async function listAllActiveUsers(): Promise<User[]>;
export async function listAllActiveUsers(sql: Sql): Promise<User[]>;
export async function listAllActiveUsers(_sql?: Sql): Promise<User[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM users WHERE active = 1 ORDER BY created_at ASC
  `;
  return (rows as UserRow[]).map(parseUser);
}

export async function listAllUsers(): Promise<User[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM users ORDER BY created_at ASC`;
  return (rows as UserRow[]).map(parseUser);
}

/* ---------- Clients ---------- */

export interface ClientRow {
  id: string;
  owner_id: string;
  name: string;
  emails: string;
  phones: string;
  reminder_channel: ReminderChannel;
  notes: string | null;
  case_type: CaseType | null;
  bank: string | null;
  required_amount: number | null;
  property_value: number | null;
  property_address: string | null;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  income_snapshot: string | null;
  income_snapshot_at: string | null;
  income_source_filename: string | null;
  spouse_name: string | null;
  spouse_email: string | null;
  spouse_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  emails: string[];
  phones: string[];
  reminderChannel: ReminderChannel;
  notes: string | null;
  caseType: CaseType | null;
  bank: string | null;
  requiredAmount: number | null;
  propertyValue: number | null;
  propertyAddress: string | null;
  driveFolderUrl: string | null;
  driveFolderId: string | null;
  incomeSnapshot: IncomeSnapshot | null;
  incomeSnapshotAt: string | null;
  incomeSourceFilename: string | null;
  spouseName: string | null;
  spouseEmail: string | null;
  spousePhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export function parseClient(row: ClientRow): Client {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    emails: safeJsonArray(row.emails),
    phones: safeJsonArray(row.phones),
    reminderChannel: row.reminder_channel,
    notes: row.notes,
    caseType: (row.case_type as CaseType) || null,
    bank: row.bank ?? null,
    requiredAmount:
      row.required_amount == null || row.required_amount === undefined
        ? null
        : Number(row.required_amount),
    propertyValue:
      row.property_value == null || row.property_value === undefined
        ? null
        : Number(row.property_value),
    propertyAddress: row.property_address ?? null,
    driveFolderUrl: row.drive_folder_url ?? null,
    driveFolderId: row.drive_folder_id ?? null,
    incomeSnapshot: parseIncomeSnapshotJson(row.income_snapshot),
    incomeSnapshotAt: row.income_snapshot_at ?? null,
    incomeSourceFilename: row.income_source_filename ?? null,
    spouseName: row.spouse_name ?? null,
    spouseEmail: row.spouse_email ?? null,
    spousePhone: row.spouse_phone ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseIncomeSnapshotJson(raw: string | null): IncomeSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as IncomeSnapshot;
    }
  } catch {
    // ignore
  }
  return null;
}

/* ---------- Deposits ---------- */

export interface DepositRow {
  id: string;
  owner_id: string;
  client_id: string;
  association_id: string | null;
  deposit_type: DepositType;
  responsibility: DepositResponsibility;
  amount: number;
  day_of_month: number;
  days_before_reminder: number;
  start_date: string;
  end_date: string | null;
  reminder_recipient: ReminderRecipient;
  scholarship_delivery: ScholarshipDelivery | null;
  active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deposit {
  id: string;
  ownerId: string;
  clientId: string;
  associationId: string | null;
  depositType: DepositType;
  responsibility: DepositResponsibility;
  amount: number;
  dayOfMonth: number;
  daysBeforeReminder: number;
  startDate: string;
  endDate: string | null;
  reminderRecipient: ReminderRecipient;
  scholarshipDelivery: ScholarshipDelivery | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function parseDeposit(row: DepositRow): Deposit {
  return {
    id: row.id,
    ownerId: row.owner_id,
    clientId: row.client_id,
    associationId: row.association_id,
    depositType: row.deposit_type,
    responsibility: row.responsibility,
    amount: Number(row.amount),
    dayOfMonth: Number(row.day_of_month),
    daysBeforeReminder: Number(row.days_before_reminder),
    startDate: row.start_date,
    endDate: row.end_date,
    reminderRecipient: row.reminder_recipient,
    scholarshipDelivery: (row.scholarship_delivery as ScholarshipDelivery) || null,
    active: !!row.active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------- Associations ---------- */

export interface AssociationRow {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  bank_number: string | null;
  branch_number: string | null;
  account_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Association {
  id: string;
  ownerId: string;
  name: string;
  email: string | null;
  bankNumber: string | null;
  branchNumber: string | null;
  accountNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function parseAssociation(row: AssociationRow): Association {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    email: row.email ?? null,
    bankNumber: row.bank_number,
    branchNumber: row.branch_number,
    accountNumber: row.account_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------- Reminders ---------- */

export interface ReminderRow {
  id: string;
  owner_id: string;
  deposit_id: string;
  client_id: string;
  status: ReminderStatus;
  phase: ReminderPhase;
  escalated_to_client: number;
  target_date: string;
  scheduled_for: string;
  last_sent_at: string | null;
  sends_count: number;
  client_response: string | null;
  client_response_at: string | null;
  paid_at: string | null;
  action_done_at: string | null;
  payment_done_at: string | null;
  subject: string | null;
  body: string | null;
  upload_token: string | null;
  snooze_until: string | null;
  client_remind_at: string | null;
  month_bucket: string;
  carried_over: number;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  ownerId: string;
  depositId: string;
  clientId: string;
  status: ReminderStatus;
  phase: ReminderPhase;
  escalatedToClient: boolean;
  targetDate: string;
  scheduledFor: string;
  lastSentAt: string | null;
  sendsCount: number;
  clientResponse: string | null;
  clientResponseAt: string | null;
  paidAt: string | null;
  actionDoneAt: string | null;
  paymentDoneAt: string | null;
  subject: string | null;
  body: string | null;
  uploadToken: string | null;
  snoozeUntil: string | null;
  clientRemindAt: string | null;
  monthBucket: string;
  carriedOver: boolean;
  createdAt: string;
  updatedAt: string;
}

export function parseReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    depositId: row.deposit_id,
    clientId: row.client_id,
    status: row.status,
    phase: row.phase,
    escalatedToClient: !!row.escalated_to_client,
    targetDate: row.target_date,
    scheduledFor: row.scheduled_for,
    lastSentAt: row.last_sent_at,
    sendsCount: Number(row.sends_count),
    clientResponse: row.client_response,
    clientResponseAt: row.client_response_at,
    paidAt: row.paid_at,
    actionDoneAt: row.action_done_at ?? null,
    paymentDoneAt: row.payment_done_at ?? row.paid_at ?? null,
    subject: row.subject,
    body: row.body,
    uploadToken: row.upload_token,
    snoozeUntil: row.snooze_until,
    clientRemindAt: row.client_remind_at ?? null,
    monthBucket: row.month_bucket,
    carriedOver: !!row.carried_over,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------- Messages ---------- */

export type MessageDirection = "in" | "out" | "system";

export interface MessageRow {
  id: string;
  owner_id: string;
  reminder_id: string;
  direction: MessageDirection;
  subject: string | null;
  body: string;
  email_status: string | null;
  email_error: string | null;
  metadata: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  ownerId: string;
  reminderId: string;
  direction: MessageDirection;
  subject: string | null;
  body: string;
  emailStatus: string | null;
  emailError: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function parseMessage(row: MessageRow): Message {
  let meta: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata);
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {}
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    reminderId: row.reminder_id,
    direction: row.direction,
    subject: row.subject,
    body: row.body,
    emailStatus: row.email_status,
    emailError: row.email_error,
    metadata: meta,
    createdAt: row.created_at,
  };
}

/* ---------- Helpers ---------- */

function safeJsonArray(input: unknown): string[] {
  if (typeof input !== "string") return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

export function monthBucketOf(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

export function currentMonthBucket(): string {
  return monthBucketOf(new Date());
}

/**
 * Returns the current ISO timestamp string (UTC, no ms).
 * Use this in place of SQLite's datetime('now') when inserting.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------- Legacy compatibility shims ---------------- */

export interface Advisor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  logoFilename: string | null;
  isPrimary: boolean;
  dashboardCards: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export function userAsAdvisor(u: User): Advisor {
  return {
    id: u.id,
    userId: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    companyName: u.companyName,
    logoFilename: u.logoFilename,
    isPrimary: true,
    dashboardCards: u.dashboardCards,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
