import type { IncomeLine, IncomeSnapshot, LiabilityLine } from "./db";

export function sumIncomes(incomes: IncomeLine[]): number {
  return incomes.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

export function sumLiabilities(liabilities: LiabilityLine[]): number {
  return liabilities.reduce((s, l) => s + (Number(l.monthly) || 0), 0);
}

/** החזר חודשי משוער = (סכום מבוקש / 100,000) × סכום לכל 100k */
export function estimatedMonthlyRepayment(
  requiredAmount: number | null | undefined,
  amountPer100k: number | null | undefined
): number | null {
  if (
    requiredAmount == null ||
    amountPer100k == null ||
    !Number.isFinite(requiredAmount) ||
    !Number.isFinite(amountPer100k) ||
    requiredAmount <= 0
  ) {
    return null;
  }
  return (requiredAmount / 100_000) * amountPer100k;
}

/**
 * הכנסה נדרשת ליחס החזר:
 * החזר / ratio + התחייבויות
 */
export function requiredIncomeAtRatio(
  repayment: number,
  liabilities: number,
  ratio: number
): number {
  if (ratio <= 0) return 0;
  return repayment / ratio + Math.max(0, liabilities);
}

export type AffordabilityTone = "pass" | "mid" | "fail" | null;

/**
 * pass: הכנסה ≥ תחשיב 35%
 * mid: בין תחשיב 40% ל-35%
 * fail: מתחת לתחשיב 40%
 */
export function affordabilityTone(
  totalIncome: number,
  required35: number,
  required40: number
): AffordabilityTone {
  if (!Number.isFinite(totalIncome)) return null;
  if (totalIncome >= required35) return "pass";
  if (totalIncome >= required40) return "mid";
  return "fail";
}

/** החזר חודשי לכל 100,000 לפי שנים וריבית שנתית (%) — שפיצר */
export function paymentPer100kFromRate(
  years: number,
  annualRatePercent: number
): number | null {
  if (
    !Number.isFinite(years) ||
    !Number.isFinite(annualRatePercent) ||
    years <= 0 ||
    annualRatePercent < 0
  ) {
    return null;
  }
  const principal = 100_000;
  const n = Math.round(years * 12);
  if (n <= 0) return null;
  if (annualRatePercent === 0) return principal / n;
  const i = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + i, n);
  return (principal * (i * factor)) / (factor - 1);
}

export interface LoanTrancheInput {
  /** אחוז מהסכום (0–100) */
  percent: number;
  years: number;
  annualRatePercent: number;
}

/**
 * החזר חודשי משוקלל לכל 100,000 —
 * כל שורה: (אחוז/100) × החזר שפיצר על 100k באותם שנים/ריבית
 */
export function blendedPaymentPer100k(
  tranches: LoanTrancheInput[]
): { total: number; percentSum: number; rows: number[] } | null {
  if (!tranches.length) return null;
  let total = 0;
  let percentSum = 0;
  const rows: number[] = [];
  for (const t of tranches) {
    const pct = Number(t.percent);
    const per = paymentPer100kFromRate(t.years, t.annualRatePercent);
    if (!Number.isFinite(pct) || pct < 0 || per == null) return null;
    percentSum += pct;
    const share = (pct / 100) * per;
    rows.push(share);
    total += share;
  }
  if (!Number.isFinite(total)) return null;
  return { total, percentSum, rows };
}

export function recomputeSnapshotTotals(
  snapshot: Pick<IncomeSnapshot, "incomes" | "liabilities"> &
    Partial<IncomeSnapshot>
): IncomeSnapshot {
  const totalIncome = sumIncomes(snapshot.incomes);
  const totalLiabilitiesMonthly = sumLiabilities(snapshot.liabilities);
  const disposable40 = Math.max(0, totalIncome - totalLiabilitiesMonthly) * 0.4;
  const disposable35 = Math.max(0, totalIncome - totalLiabilitiesMonthly) * 0.35;
  return {
    ...snapshot,
    incomes: snapshot.incomes,
    liabilities: snapshot.liabilities,
    totalIncome,
    totalLiabilitiesMonthly,
    totalMonthlyRepayment:
      snapshot.totalMonthlyRepayment ?? totalLiabilitiesMonthly,
    disposable40,
    disposable35,
  };
}

export function emptyIncomeSnapshot(): IncomeSnapshot {
  return recomputeSnapshotTotals({ incomes: [], liabilities: [] });
}
