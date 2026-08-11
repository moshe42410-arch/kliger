/**
 * Parse "סיכום שיחה" Excel — הכנסות + התחייבויות קיימות.
 */
import * as XLSX from "xlsx";
import type { IncomeLine, IncomeSnapshot, LiabilityLine } from "./db";

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

function findHeaderRow(
  rows: unknown[][],
  needles: string[]
): { rowIndex: number; colMap: Record<string, number> } | null {
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const row = rows[r] || [];
    const texts = row.map((c) => cellStr(c));
    const joined = texts.join("|");
    const hit = needles.every((n) => joined.includes(n));
    if (!hit) continue;
    const colMap: Record<string, number> = {};
    texts.forEach((t, i) => {
      if (t) colMap[t] = i;
    });
    return { rowIndex: r, colMap };
  }
  return null;
}

function colOf(colMap: Record<string, number>, ...aliases: string[]): number {
  for (const a of aliases) {
    for (const [k, i] of Object.entries(colMap)) {
      if (k.includes(a)) return i;
    }
  }
  return -1;
}

function parseIncomes(rows: unknown[][]): {
  lines: IncomeLine[];
  totalIncome: number | null;
  disposable40: number | null;
  disposable35: number | null;
} {
  const header = findHeaderRow(rows, ["סכום", "הערות"]);
  const lines: IncomeLine[] = [];
  let totalIncome: number | null = null;
  let disposable40: number | null = null;
  let disposable35: number | null = null;

  if (!header) {
    return { lines, totalIncome, disposable40, disposable35 };
  }

  const iStatus = colOf(header.colMap, "קיים", "מבוקש");
  const iPerson = colOf(header.colMap, "איש", "אשה");
  const iAmount = colOf(header.colMap, "סכום");
  const iNotes = colOf(header.colMap, "הערות");
  const iRole = colOf(header.colMap, "מקצוע", "תפקיד");

  for (let r = header.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const amount = iAmount >= 0 ? cellNum(row[iAmount]) : null;
    const joined = row.map(cellStr).join(" ");

    if (joined.includes("התחייבויות")) break;
    if (joined.includes("הכנסות") && !amount) continue;

    if (
      joined.includes('סה"כ הכנסות') ||
      joined.includes("סה״כ הכנסות") ||
      joined.includes("סהכ הכנסות") ||
      (joined.includes("סה") && joined.includes("הכנסות"))
    ) {
      totalIncome = amount ?? totalIncome;
      continue;
    }
    if (joined.includes("הכנסה פנויה 40") || joined.includes("פנויה 40%")) {
      disposable40 = amount ?? disposable40;
      continue;
    }
    if (joined.includes("הכנסה פנויה 35") || joined.includes("פנויה 35%")) {
      disposable35 = amount ?? disposable35;
      continue;
    }
    if (amount == null || amount === 0) continue;

    const status = iStatus >= 0 ? cellStr(row[iStatus]) || null : null;
    const notes = iNotes >= 0 ? cellStr(row[iNotes]) || null : null;
    const person = iPerson >= 0 ? cellStr(row[iPerson]) || null : null;
    if (!status && !notes && !person) continue;

    lines.push({
      status,
      person,
      amount,
      notes,
      role: iRole >= 0 ? cellStr(row[iRole]) || null : null,
    });
  }

  return { lines, totalIncome, disposable40, disposable35 };
}

function parseLiabilities(rows: unknown[][]): {
  lines: LiabilityLine[];
  totalLiabilitiesMonthly: number | null;
  totalMonthlyRepayment: number | null;
  requestedIncome35: number | null;
} {
  const header = findHeaderRow(rows, ["החזר", "היכן"]);
  const lines: LiabilityLine[] = [];
  let totalLiabilitiesMonthly: number | null = null;
  let totalMonthlyRepayment: number | null = null;
  let requestedIncome35: number | null = null;

  if (!header) {
    return { lines, totalLiabilitiesMonthly, totalMonthlyRepayment, requestedIncome35 };
  }

  const iKind = colOf(header.colMap, "משכנתא", "הלוואה");
  const iWhere = colOf(header.colMap, "היכן");
  const iMonthly = colOf(header.colMap, "החזר");
  const iBalance = colOf(header.colMap, "יתרה", "ייתרה");
  const iEnd = colOf(header.colMap, "תאריך סיום", "סיום");
  const iTaken = colOf(header.colMap, "נלקח");

  for (let r = header.rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const joined = row.map(cellStr).join(" ");
    const monthly = iMonthly >= 0 ? cellNum(row[iMonthly]) : null;
    const balance = iBalance >= 0 ? cellNum(row[iBalance]) : null;

    if (
      joined.includes('סה"כ התחייבות') ||
      joined.includes("סה״כ התחייבות") ||
      joined.includes("סהכ התחייבות") ||
      (joined.includes("סה") && joined.includes("התחייב"))
    ) {
      if (monthly != null) totalLiabilitiesMonthly = monthly;
      continue;
    }
    if (joined.includes("החזר חודשי כולל")) {
      if (monthly != null) totalMonthlyRepayment = monthly;
      continue;
    }
    if (joined.includes("הכנסה מבוקשת") || joined.includes("לכל בנק")) {
      const n = monthly ?? balance ?? cellNum(row[row.length - 1]);
      if (n != null) requestedIncome35 = n;
      continue;
    }

    const kind = iKind >= 0 ? cellStr(row[iKind]) : "";
    if (!kind) continue;
    if (monthly == null && balance == null) continue;
    lines.push({
      kind: kind || null,
      where: iWhere >= 0 ? cellStr(row[iWhere]) || null : null,
      monthly: monthly ?? 0,
      balance,
      endDate: iEnd >= 0 ? cellStr(row[iEnd]) || null : null,
      takenIn: iTaken >= 0 ? cellStr(row[iTaken]) || null : null,
    });
  }

  return { lines, totalLiabilitiesMonthly, totalMonthlyRepayment, requestedIncome35 };
}

export function parseConversationSummaryBuffer(buf: Buffer | ArrayBuffer): IncomeSnapshot {
  const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { incomes: [], liabilities: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  // Split roughly by section title if both on same sheet
  let incomeEnd = rows.findIndex((row) =>
    cellStr(row[0]).includes("התחייבויות")
  );
  if (incomeEnd < 0) incomeEnd = rows.length;

  const incomePart = rows.slice(0, incomeEnd);
  const liabilityPart = incomeEnd < rows.length ? rows.slice(incomeEnd) : rows;

  const incomes = parseIncomes(incomePart.length ? incomePart : rows);
  const liabilities = parseLiabilities(liabilityPart.length ? liabilityPart : rows);

  // Fallback: try other sheets by name
  for (const name of workbook.SheetNames) {
    if (/הכנס/.test(name)) {
      const r = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];
      const p = parseIncomes(r);
      if (p.lines.length) Object.assign(incomes, p);
    }
    if (/התחייב|הלווא/.test(name)) {
      const r = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];
      const p = parseLiabilities(r);
      if (p.lines.length) Object.assign(liabilities, p);
    }
  }

  return {
    incomes: incomes.lines,
    liabilities: liabilities.lines,
    totalIncome: incomes.totalIncome,
    disposable40:
      incomes.totalIncome != null
        ? Math.max(
            0,
            incomes.totalIncome -
              (liabilities.totalLiabilitiesMonthly ??
                liabilities.totalMonthlyRepayment ??
                0)
          ) * 0.4
        : incomes.disposable40,
    disposable35:
      incomes.totalIncome != null
        ? Math.max(
            0,
            incomes.totalIncome -
              (liabilities.totalLiabilitiesMonthly ??
                liabilities.totalMonthlyRepayment ??
                0)
          ) * 0.35
        : incomes.disposable35,
    totalLiabilitiesMonthly: liabilities.totalLiabilitiesMonthly,
    totalMonthlyRepayment: liabilities.totalMonthlyRepayment,
    requestedIncome35: liabilities.requestedIncome35,
  };
}
