/**
 * Parse clients list Excel — שורה לכל לקוח, כותרות בעברית.
 */
import * as XLSX from "xlsx";
import type { CaseType, ReminderChannel } from "./db";
import { BANK_OPTIONS, CASE_TYPES, caseTypeLabel } from "./types";

export interface ParsedClientImportRow {
  rowNumber: number;
  name: string;
  emails: string[];
  phones: string[];
  reminderChannel: ReminderChannel;
  caseType: CaseType | null;
  bank: string | null;
  requiredAmount: number | null;
  propertyValue: number | null;
  propertyAddress: string | null;
}

export interface ParseClientsExcelResult {
  rows: ParsedClientImportRow[];
  errors: Array<{ rowNumber: number; message: string }>;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[₪,\s]/g, "").replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitList(v: unknown): string[] {
  const s = cellStr(v);
  if (!s) return [];
  return s
    .split(/[,;|/\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["שם לקוח", "שם", "לקוח", "name", "full name"],
  emails: ["מייל", "אימייל", "דואל", 'דוא"ל', "email", "emails", "e-mail"],
  phones: ["טלפון", "פלאפון", "נייד", "phone", "phones", "mobile"],
  caseType: ["מהות התיק", "מהות תיק", "סוג תיק", "סוג", "case type", "case"],
  bank: ["בנק", "bank"],
  requiredAmount: [
    "סכום מבוקש",
    "סכום נדרש",
    "סכום",
    "required amount",
    "amount",
  ],
  propertyValue: ["שווי נכס", "שווי", "property value", "value"],
  propertyAddress: ["כתובת נכס", "כתובת", "address"],
  reminderChannel: ["ערוץ תזכורת", "ערוץ", "תזכורת", "channel"],
};

function mapHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((raw, i) => {
    const h = normalizeHeader(cellStr(raw));
    if (!h) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] != null) continue;
      if (aliases.some((a) => h === normalizeHeader(a) || h.includes(normalizeHeader(a)))) {
        map[field] = i;
      }
    }
  });
  return map;
}

function parseCaseType(raw: string): CaseType | null {
  const s = raw.trim();
  if (!s) return null;
  if ((CASE_TYPES as string[]).includes(s)) return s as CaseType;
  const byLabel = (Object.entries(caseTypeLabel) as [CaseType, string][]).find(
    ([, label]) => label === s || s.includes(label)
  );
  return byLabel?.[0] ?? null;
}

function parseBank(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const hit = BANK_OPTIONS.find((b) => b === s || s.includes(b) || b.includes(s));
  return hit || s;
}

function parseChannel(raw: string): ReminderChannel {
  const s = raw.trim().toLowerCase();
  if (!s) return "email";
  if (s.includes("both") || s.includes("שני") || s.includes("ומייל")) return "both";
  if (s.includes("phone") || s.includes("טלפון") || s.includes("פלאפון"))
    return "phone";
  return "email";
}

function findHeaderRow(rows: unknown[][]): {
  rowIndex: number;
  colMap: Record<string, number>;
} | null {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const colMap = mapHeaders(rows[r] || []);
    if (colMap.name != null) return { rowIndex: r, colMap };
  }
  return null;
}

export function parseClientsExcelBuffer(buf: Buffer): ParseClientsExcelResult {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: "הקובץ ריק" }] };
  }
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  const header = findHeaderRow(matrix);
  if (!header) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 0,
          message: 'לא נמצאה עמודת "שם" / "שם לקוח" — בדוק את כותרות הקובץ',
        },
      ],
    };
  }

  const { rowIndex, colMap } = header;
  const rows: ParsedClientImportRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let r = rowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const rowNumber = r + 1;
    const name = cellStr(row[colMap.name]);
    if (!name) {
      const anyVal = row.some((c) => cellStr(c));
      if (anyVal) {
        errors.push({ rowNumber, message: "חסר שם לקוח" });
      }
      continue;
    }

    const emails =
      colMap.emails != null ? splitList(row[colMap.emails]) : [];
    const phones =
      colMap.phones != null ? splitList(row[colMap.phones]) : [];
    const caseRaw =
      colMap.caseType != null ? cellStr(row[colMap.caseType]) : "";
    const bankRaw = colMap.bank != null ? cellStr(row[colMap.bank]) : "";
    const addr =
      colMap.propertyAddress != null
        ? cellStr(row[colMap.propertyAddress]) || null
        : null;
    const channelRaw =
      colMap.reminderChannel != null
        ? cellStr(row[colMap.reminderChannel])
        : "";

    const caseType = parseCaseType(caseRaw);
    if (caseRaw && !caseType) {
      errors.push({
        rowNumber,
        message: `מהות תיק לא מזוהה: "${caseRaw}" (תוספת / רכישה / שיפוצים / הרחבה)`,
      });
    }

    rows.push({
      rowNumber,
      name,
      emails,
      phones,
      reminderChannel: parseChannel(channelRaw),
      caseType,
      bank: parseBank(bankRaw),
      requiredAmount:
        colMap.requiredAmount != null
          ? cellNum(row[colMap.requiredAmount])
          : null,
      propertyValue:
        colMap.propertyValue != null
          ? cellNum(row[colMap.propertyValue])
          : null,
      propertyAddress: addr,
    });
  }

  return { rows, errors };
}

/** תבנית אקסל לייבוא לקוחות */
export function buildClientsImportTemplateBuffer(): Buffer {
  const headers = [
    "שם לקוח",
    "מייל",
    "טלפון",
    "מהות התיק",
    "בנק",
    "סכום מבוקש",
    "שווי נכס",
    "כתובת נכס",
    "ערוץ תזכורת",
  ];
  const sample = [
    "ישראל ישראלי",
    "israel@example.com",
    "0501234567",
    "תוספת",
    "פועלים",
    750000,
    1500000,
    "תל אביב",
    "מייל",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "לקוחות");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
