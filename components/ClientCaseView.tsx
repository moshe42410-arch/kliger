"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Building2,
  FolderOpen,
  Home,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
  Bell,
  Plus,
  Trash2,
  Pencil,
  Calculator,
  X,
  Users,
} from "lucide-react";
import type {
  Client,
  CaseType,
  ReminderChannel,
  IncomeLine,
  LiabilityLine,
  IncomeSnapshot,
} from "@/lib/db";
import {
  BANK_OPTIONS,
  CASE_TYPES,
  caseTypeLabel,
  detectIncomeKeywords,
} from "@/lib/types";
import {
  affordabilityTone,
  blendedPaymentPer100k,
  estimatedMonthlyRepayment,
  recomputeSnapshotTotals,
  requiredIncomeAtRatio,
  sumIncomes,
  sumLiabilities,
} from "@/lib/affordability";

type CalcTrancheRow = {
  id: string;
  percent: string;
  years: string;
  rate: string;
};

function newTrancheRow(
  partial?: Partial<Omit<CalcTrancheRow, "id">>
): CalcTrancheRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    percent: partial?.percent ?? "100",
    years: partial?.years ?? "",
    rate: partial?.rate ?? "",
  };
}

function formatILS(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₪${n}`;
  }
}

function financingPercent(
  requiredAmount: number | null | undefined,
  propertyValue: number | null | undefined
): number | null {
  if (
    requiredAmount == null ||
    propertyValue == null ||
    !Number.isFinite(requiredAmount) ||
    !Number.isFinite(propertyValue) ||
    propertyValue <= 0
  ) {
    return null;
  }
  return (requiredAmount / propertyValue) * 100;
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded)
    ? `${rounded}%`
    : `${rounded.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%`;
}

const TONE_STYLES = {
  pass: "bg-[#eef2f7] border-[#002147]/30 text-navy-950",
  mid: "bg-[#f4f4f5] border-[#71717a]/35 text-navy-900",
  fail: "bg-[#f8eaea] border-[#b91c1c]/35 text-[#7f1d1d]",
} as const;

const TONE_LABELS = {
  pass: "תקין — מעל תחשיב 35%",
  mid: "גבולי — בין 35% ל-40%",
  fail: "חסר — מתחת לתחשיב 40%",
} as const;

interface Props {
  initialClient: Client;
}

export function ClientCaseView({ initialClient }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [client, setClient] = useState(initialClient);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initialClient.name,
    emails: initialClient.emails.length ? initialClient.emails : [""],
    phones: initialClient.phones.length ? initialClient.phones : [""],
    reminderChannel: initialClient.reminderChannel as ReminderChannel,
    caseType: (initialClient.caseType || "") as CaseType | "",
    bank: initialClient.bank || "",
    requiredAmount: initialClient.requiredAmount?.toString() || "",
    propertyValue: initialClient.propertyValue?.toString() || "",
    propertyAddress: initialClient.propertyAddress || "",
    driveFolderUrl: initialClient.driveFolderUrl || "",
    spouseName: initialClient.spouseName || "",
    spouseEmail: initialClient.spouseEmail || "",
    spousePhone: initialClient.spousePhone || "",
  });

  const [editingIncome, setEditingIncome] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);
  const [incomes, setIncomes] = useState<IncomeLine[]>(
    initialClient.incomeSnapshot?.incomes || []
  );
  const [liabilities, setLiabilities] = useState<LiabilityLine[]>(
    initialClient.incomeSnapshot?.liabilities || []
  );
  const [amountPer100k, setAmountPer100k] = useState(
    initialClient.incomeSnapshot?.amountPer100k != null
      ? String(initialClient.incomeSnapshot.amountPer100k)
      : ""
  );
  const [savingPer100k, setSavingPer100k] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTranches, setCalcTranches] = useState<CalcTrancheRow[]>([
    newTrancheRow(),
  ]);

  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  useEffect(() => {
    if (editingIncome) return;
    setIncomes(client.incomeSnapshot?.incomes || []);
    setLiabilities(client.incomeSnapshot?.liabilities || []);
    setAmountPer100k(
      client.incomeSnapshot?.amountPer100k != null
        ? String(client.incomeSnapshot.amountPer100k)
        : ""
    );
  }, [client.incomeSnapshot, editingIncome]);

  const calcBlend = useMemo(() => {
    const parsed = calcTranches.map((t) => ({
      percent: Number(t.percent),
      years: Number(t.years),
      annualRatePercent: Number(t.rate),
    }));
    if (parsed.some((t) => !Number.isFinite(t.percent) || !Number.isFinite(t.years) || !Number.isFinite(t.annualRatePercent))) {
      return null;
    }
    return blendedPaymentPer100k(parsed);
  }, [calcTranches]);

  const calcPreviewPer100k =
    calcBlend != null ? Math.round(calcBlend.total * 100) / 100 : null;
  const calcPercentSum = calcBlend?.percentSum ?? 0;

  const draftSnapshot: IncomeSnapshot = useMemo(
    () =>
      recomputeSnapshotTotals({
        incomes,
        liabilities,
        amountPer100k: amountPer100k ? Number(amountPer100k) : null,
      }),
    [incomes, liabilities, amountPer100k]
  );

  const calc = useMemo(() => {
    const per100k = amountPer100k ? Number(amountPer100k) : null;
    const repayment = estimatedMonthlyRepayment(
      client.requiredAmount,
      per100k != null && Number.isFinite(per100k) ? per100k : null
    );
    const liab = sumLiabilities(liabilities);
    const income = sumIncomes(incomes);
    if (repayment == null) {
      return {
        repayment: null as number | null,
        required35: null as number | null,
        required40: null as number | null,
        tone: null as ReturnType<typeof affordabilityTone>,
        income,
        liab,
      };
    }
    const required40 = requiredIncomeAtRatio(repayment, liab, 0.4);
    const required35 = requiredIncomeAtRatio(repayment, liab, 0.35);
    return {
      repayment,
      required35,
      required40,
      tone: affordabilityTone(income, required35, required40),
      income,
      liab,
    };
  }, [amountPer100k, client.requiredAmount, incomes, liabilities]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        emails: form.emails.map((e) => e.trim()).filter(Boolean),
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
        reminderChannel: form.reminderChannel,
        caseType: form.caseType || null,
        bank: form.bank || null,
        requiredAmount: form.requiredAmount ? Number(form.requiredAmount) : null,
        propertyValue: form.propertyValue ? Number(form.propertyValue) : null,
        propertyAddress: form.propertyAddress.trim() || null,
        driveFolderUrl: form.driveFolderUrl.trim() || null,
        driveFolderId: client.driveFolderId,
        spouseName: form.spouseName.trim() || null,
        spouseEmail: form.spouseEmail.trim() || null,
        spousePhone: form.spousePhone.trim() || null,
      };
      if (!payload.name) throw new Error("שם הלקוח חובה");
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שמירה נכשלה");
      }
      const saved: Client = await res.json();
      setClient(saved);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function uploadExcel(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/clients/${client.id}/income-excel`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "העלאה נכשלה");
      }
      const saved: Client = await res.json();
      setClient(saved);
      setEditingIncome(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveIncomeSnapshot(options?: { keepEditing?: boolean }) {
    setSavingIncome(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/income-snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomes,
          liabilities,
          amountPer100k: amountPer100k ? Number(amountPer100k) : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שמירת הכנסות נכשלה");
      }
      const saved: Client = await res.json();
      setClient(saved);
      if (!options?.keepEditing) setEditingIncome(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingIncome(false);
    }
  }

  async function saveAmountPer100kOnly() {
    setSavingPer100k(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/income-snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incomes: client.incomeSnapshot?.incomes || incomes,
          liabilities: client.incomeSnapshot?.liabilities || liabilities,
          amountPer100k: amountPer100k ? Number(amountPer100k) : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שמירה נכשלה");
      }
      const saved: Client = await res.json();
      setClient(saved);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPer100k(false);
    }
  }

  function applyCalcToPer100k() {
    if (calcPreviewPer100k == null) return;
    if (Math.abs(calcPercentSum - 100) > 0.05) return;
    setAmountPer100k(String(Math.round(calcPreviewPer100k)));
    setCalcOpen(false);
  }

  function openCalcModal() {
    setCalcTranches([newTrancheRow()]);
    setCalcOpen(true);
  }

  function startManualEdit() {
    if (!client.incomeSnapshot) {
      setIncomes([]);
      setLiabilities([]);
    }
    setEditingIncome(true);
  }

  const caseLabel = client.caseType ? caseTypeLabel[client.caseType] : null;
  const hasSnapshot =
    !!client.incomeSnapshot ||
    incomes.length > 0 ||
    liabilities.length > 0 ||
    editingIncome;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-16">
      <div className="mb-6">
        <Link href="/clients" className="btn-ghost inline-flex text-sm">
          <ArrowRight size={16} /> חזרה ללקוחות
        </Link>
      </div>

      <section className="card mb-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4 min-w-0">
            <p className="text-sm font-medium tracking-wide text-navy-600">
              תיק לקוח
            </p>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-navy-950 leading-tight">
              {client.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="case-meta">
                <Home size={14} strokeWidth={1.75} />
                {caseLabel || "מהות טרם הוגדרה"}
              </span>
              {client.bank && (
                <span className="case-meta">
                  <Landmark size={14} strokeWidth={1.75} />
                  {client.bank}
                </span>
              )}
              {(() => {
                const pct = financingPercent(
                  client.requiredAmount,
                  client.propertyValue
                );
                if (pct == null) return null;
                return (
                  <span className="case-meta">
                    אחוז מימון {formatPercent(pct)}
                  </span>
                );
              })()}
            </div>
            {client.propertyAddress && (
              <p className="text-navy-700 flex items-start gap-2 text-sm">
                <MapPin size={16} className="mt-0.5 text-navy-500 shrink-0" />
                {client.propertyAddress}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right lg:min-w-[220px]">
            <p className="text-sm text-navy-600 mb-1">סכום מבוקש</p>
            <p className="text-4xl md:text-5xl font-heading font-bold text-navy-950 tabular-nums tracking-tight">
              {formatILS(client.requiredAmount)}
            </p>
            {client.propertyValue != null && (
              <p className="text-sm text-navy-600 mt-2">
                שווי נכס · {formatILS(client.propertyValue)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-navy-100 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "סגור עריכה" : "עריכת רקע תיק"}
          </button>
          <Link href={`/deposits?newClientId=${client.id}`} className="btn-primary">
            <Plus size={16} strokeWidth={1.75} /> הפקדה חדשה
          </Link>
          <Link href={`/reminders?clientId=${client.id}`} className="btn-secondary">
            <Bell size={16} strokeWidth={1.75} /> תזכורות
          </Link>
        </div>
      </section>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {editing && (
        <section className="card mb-8 space-y-5">
          <h2 className="text-xl font-heading font-bold text-navy-950">עריכת תיק</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">שם *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">מהות התיק</label>
              <select
                className="select"
                value={form.caseType}
                onChange={(e) =>
                  setForm({ ...form, caseType: e.target.value as CaseType | "" })
                }
              >
                <option value="">— בחירה —</option>
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {caseTypeLabel[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">בנק</label>
              <select
                className="select"
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
              >
                <option value="">— בחירה —</option>
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">סכום נדרש</label>
              <input
                className="input"
                type="number"
                dir="ltr"
                value={form.requiredAmount}
                onChange={(e) =>
                  setForm({ ...form, requiredAmount: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">שווי נכס</label>
              <input
                className="input"
                type="number"
                dir="ltr"
                value={form.propertyValue}
                onChange={(e) =>
                  setForm({ ...form, propertyValue: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">כתובת הנכס</label>
              <input
                className="input"
                value={form.propertyAddress}
                onChange={(e) =>
                  setForm({ ...form, propertyAddress: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">מיילים</label>
              <input
                className="input"
                dir="ltr"
                value={form.emails.join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    emails: e.target.value.split(",").map((x) => x.trim()),
                  })
                }
                placeholder="a@b.com, c@d.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">טלפונים</label>
              <input
                className="input"
                dir="ltr"
                value={form.phones.join(", ")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phones: e.target.value.split(",").map((x) => x.trim()),
                  })
                }
              />
            </div>
            <div className="md:col-span-2 pt-2 border-t border-navy-100">
              <p className="text-sm font-semibold text-navy-800 mb-3">בן / בת זוג</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="label">שם</label>
                  <input
                    className="input"
                    value={form.spouseName}
                    onChange={(e) =>
                      setForm({ ...form, spouseName: e.target.value })
                    }
                    placeholder="אופציונלי"
                  />
                </div>
                <div>
                  <label className="label">מייל</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.spouseEmail}
                    onChange={(e) =>
                      setForm({ ...form, spouseEmail: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">טלפון</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.spousePhone}
                    onChange={(e) =>
                      setForm({ ...form, spousePhone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "שומר..." : "שמור"}
          </button>
        </section>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-start gap-3">
          <Mail className="text-navy-600 shrink-0 mt-1" size={18} />
          <div>
            <p className="text-xs text-navy-600 mb-1">מייל</p>
            <p className="text-navy-900" dir="ltr">
              {client.emails.join(", ") || "—"}
            </p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <Phone className="text-navy-600 shrink-0 mt-1" size={18} />
          <div>
            <p className="text-xs text-navy-600 mb-1">טלפון</p>
            <p className="text-navy-900" dir="ltr">
              {client.phones.join(", ") || "—"}
            </p>
          </div>
        </div>
        <div className="card flex items-start gap-3 sm:col-span-2 lg:col-span-1">
          <Users className="text-navy-600 shrink-0 mt-1" size={18} />
          <div className="min-w-0">
            <p className="text-xs text-navy-600 mb-1">בן / בת זוג</p>
            {client.spouseName || client.spouseEmail || client.spousePhone ? (
              <div className="space-y-0.5">
                <p className="text-navy-900 font-medium">
                  {client.spouseName || "—"}
                </p>
                {client.spouseEmail && (
                  <p className="text-sm text-navy-700" dir="ltr">
                    {client.spouseEmail}
                  </p>
                )}
                {client.spousePhone && (
                  <p className="text-sm text-navy-700" dir="ltr">
                    {client.spousePhone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-navy-500 text-sm">לא הוגדר</p>
            )}
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-navy-50 border border-navy-100">
            <FolderOpen className="text-navy-700" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-navy-950">
              מסמכי לקוח
            </h2>
            <p className="text-sm text-navy-600 mt-1">
              סנכרון אוטומטי עם Google Drive יגיע בהמשך. בינתיים ניתן לשמור קישור
              לתיקייה.
            </p>
          </div>
        </div>
        <div>
          <label className="label">קישור לתיקיית דרייב</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              dir="ltr"
              placeholder="https://drive.google.com/drive/folders/…"
              value={form.driveFolderUrl}
              onChange={(e) =>
                setForm({ ...form, driveFolderUrl: e.target.value })
              }
            />
            <button
              className="btn-secondary shrink-0"
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch(`/api/clients/${client.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: client.name,
                      emails: client.emails,
                      phones: client.phones,
                      reminderChannel: client.reminderChannel,
                      caseType: client.caseType,
                      bank: client.bank,
                      requiredAmount: client.requiredAmount,
                      propertyValue: client.propertyValue,
                      propertyAddress: client.propertyAddress,
                      driveFolderUrl: form.driveFolderUrl.trim() || null,
                      driveFolderId: client.driveFolderId,
                      spouseName: client.spouseName,
                      spouseEmail: client.spouseEmail,
                      spousePhone: client.spousePhone,
                    }),
                  });
                  if (!res.ok) throw new Error("שמירה נכשלה");
                  const saved: Client = await res.json();
                  setClient(saved);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSaving(false);
                }
              }}
            >
              שמור קישור
            </button>
          </div>
          {client.driveFolderUrl && (
            <a
              href={client.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-teal-700 underline mt-2 inline-block"
              dir="ltr"
            >
              פתח בתיקייה
            </a>
          )}
        </div>
      </section>

      {/* הכנסות והתחייבויות */}
      <section className="card mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Banknote className="text-teal-600" size={22} />
            <h2 className="text-xl font-heading font-bold text-navy-950">
              הכנסות והתחייבויות
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadExcel(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} />
              {uploading ? "מעבד אקסל..." : "העלאת קובץ אקסל"}
            </button>
            {!editingIncome ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={startManualEdit}
              >
                <Pencil size={16} /> הזנה / עריכה ידנית
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setEditingIncome(false);
                    setIncomes(client.incomeSnapshot?.incomes || []);
                    setLiabilities(client.incomeSnapshot?.liabilities || []);
                    setAmountPer100k(
                      client.incomeSnapshot?.amountPer100k != null
                        ? String(client.incomeSnapshot.amountPer100k)
                        : ""
                    );
                  }}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingIncome}
                  onClick={() => void saveIncomeSnapshot()}
                >
                  <Save size={16} />
                  {savingIncome ? "שומר..." : "שמור נתונים"}
                </button>
              </>
            )}
          </div>
        </div>

        {client.incomeSourceFilename && (
          <p className="text-sm text-navy-600 mb-4">
            מקור אקסל: {client.incomeSourceFilename}
            {client.incomeSnapshotAt
              ? ` · עודכן ${client.incomeSnapshotAt.slice(0, 10)}`
              : ""}
          </p>
        )}

        {/* סכום לכל 100k — תמיד זמין */}
        <div className="rounded-2xl border border-navy-100 bg-white p-4 mb-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="label">הגדרת סכום לכל 100,000 ₪</label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="input flex-1 min-w-[140px]"
                  type="number"
                  dir="ltr"
                  data-per100k="1"
                  placeholder="לדוגמה: 500"
                  value={amountPer100k}
                  onChange={(e) => setAmountPer100k(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={openCalcModal}
                  title="חישוב לפי שנים וריבית"
                >
                  <Calculator size={16} /> חישוב
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingPer100k}
                  onClick={() => void saveAmountPer100kOnly()}
                >
                  <Save size={16} />
                  {savingPer100k ? "..." : "שמור"}
                </button>
              </div>
              <p className="text-xs text-navy-500 mt-1">
                לדוגמה: 500 ₪ לכל 100k על סכום של 1,000,000 → החזר{" "}
                {formatILS(5000)}
              </p>
            </div>
            <div className="rounded-xl bg-navy-50 border border-navy-100 p-3">
              <p className="text-xs text-navy-600 mb-1">החזר משוער לסכום המבוקש</p>
              <p className="text-xl font-heading font-bold text-navy-950 tabular-nums">
                {formatILS(calc.repayment)}
              </p>
              {client.requiredAmount != null && amountPer100k && (
                <p className="text-xs text-navy-500 mt-1">
                  ({formatILS(client.requiredAmount)} ÷ 100,000) × {amountPer100k}
                </p>
              )}
            </div>
          </div>

          {calc.repayment != null && (
            <div
              className={`rounded-xl border p-4 grid sm:grid-cols-3 gap-4 ${
                calc.tone ? TONE_STYLES[calc.tone] : "bg-navy-50 border-navy-100"
              }`}
            >
              <div>
                <p className="text-xs opacity-80 mb-1">נדרש לפי 40%</p>
                <p className="text-lg font-heading font-bold tabular-nums">
                  {formatILS(calc.required40)}
                </p>
                <p className="text-[11px] opacity-70 mt-1">
                  החזר ÷ 40% + התחייבויות
                </p>
              </div>
              <div>
                <p className="text-xs opacity-80 mb-1">נדרש לפי 35%</p>
                <p className="text-lg font-heading font-bold tabular-nums">
                  {formatILS(calc.required35)}
                </p>
                <p className="text-[11px] opacity-70 mt-1">
                  החזר ÷ 35% + התחייבויות
                </p>
              </div>
              <div>
                <p className="text-xs opacity-80 mb-1">סך הכנסות בפועל</p>
                <p className="text-lg font-heading font-bold tabular-nums">
                  {formatILS(calc.income)}
                </p>
                {calc.tone && (
                  <p className="text-sm font-semibold mt-1">
                    {TONE_LABELS[calc.tone]}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {!hasSnapshot && !editingIncome ? (
          <p className="text-navy-600 text-sm">
            אין נתוני הכנסות עדיין — העלה אקסל או התחל בהזנה ידנית.
          </p>
        ) : (
          <div className="space-y-8">

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-navy-50 p-4">
                <p className="text-xs text-navy-600 mb-1">סה״כ הכנסות</p>
                <p className="text-xl font-heading font-bold text-navy-950">
                  {formatILS(draftSnapshot.totalIncome)}
                </p>
              </div>
              <div className="rounded-xl bg-navy-50 p-4">
                <p className="text-xs text-navy-600 mb-1">
                  פנויה 40%{" "}
                  <span className="font-normal">(הכנסות − התחייבויות)</span>
                </p>
                <p className="text-xl font-heading font-bold text-navy-950">
                  {formatILS(draftSnapshot.disposable40)}
                </p>
              </div>
              <div className="rounded-xl bg-navy-50 p-4">
                <p className="text-xs text-navy-600 mb-1">התחייבויות חודשיות</p>
                <p className="text-xl font-heading font-bold text-navy-950">
                  {formatILS(draftSnapshot.totalLiabilitiesMonthly)}
                </p>
              </div>
            </div>

            {/* הכנסות */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-heading font-bold text-navy-900">הכנסות</h3>
                {editingIncome && (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() =>
                      setIncomes((prev) => [
                        ...prev,
                        { status: "", person: "", amount: 0, notes: "" },
                      ])
                    }
                  >
                    <Plus size={14} /> שורת הכנסה
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-navy-600 border-b border-navy-100">
                      <th className="py-2 font-medium">סטטוס</th>
                      <th className="py-2 font-medium">איש/אשה</th>
                      <th className="py-2 font-medium">סכום</th>
                      <th className="py-2 font-medium">הערות</th>
                      {editingIncome && <th className="py-2 w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.map((line, i) => {
                      const tags = detectIncomeKeywords(line.notes);
                      return (
                        <tr key={i} className="border-b border-navy-50">
                          {editingIncome ? (
                            <>
                              <td className="py-2 pe-2">
                                <select
                                  className="select py-1.5 text-sm"
                                  value={line.status || ""}
                                  onChange={(e) =>
                                    setIncomes((prev) =>
                                      prev.map((x, idx) =>
                                        idx === i
                                          ? { ...x, status: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                >
                                  <option value="">—</option>
                                  <option value="קיים">קיים</option>
                                  <option value="מבוקש">מבוקש</option>
                                </select>
                              </td>
                              <td className="py-2 pe-2">
                                <input
                                  className="input py-1.5 text-sm"
                                  value={line.person || ""}
                                  onChange={(e) =>
                                    setIncomes((prev) =>
                                      prev.map((x, idx) =>
                                        idx === i
                                          ? { ...x, person: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 pe-2">
                                <input
                                  className="input py-1.5 text-sm"
                                  type="number"
                                  dir="ltr"
                                  value={line.amount || ""}
                                  onChange={(e) =>
                                    setIncomes((prev) =>
                                      prev.map((x, idx) =>
                                        idx === i
                                          ? {
                                              ...x,
                                              amount: Number(e.target.value) || 0,
                                            }
                                          : x
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 pe-2">
                                <input
                                  className="input py-1.5 text-sm"
                                  value={line.notes || ""}
                                  onChange={(e) =>
                                    setIncomes((prev) =>
                                      prev.map((x, idx) =>
                                        idx === i
                                          ? { ...x, notes: e.target.value }
                                          : x
                                      )
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  className="btn-danger p-2"
                                  onClick={() =>
                                    setIncomes((prev) =>
                                      prev.filter((_, idx) => idx !== i)
                                    )
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5">{line.status || "—"}</td>
                              <td className="py-2.5">{line.person || "—"}</td>
                              <td className="py-2.5 tabular-nums">
                                {formatILS(line.amount)}
                              </td>
                              <td className="py-2.5">
                                <span>{line.notes || "—"}</span>
                                {tags.length > 0 && (
                                  <span className="mr-2 text-xs text-teal-700">
                                    ({tags.join(", ")})
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {incomes.length === 0 && (
                      <tr>
                        <td
                          colSpan={editingIncome ? 5 : 4}
                          className="py-4 text-navy-500"
                        >
                          אין שורות הכנסה
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* התחייבויות */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-heading font-bold text-navy-900 flex items-center gap-2">
                  <Building2 size={16} /> התחייבויות
                </h3>
                {editingIncome && (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() =>
                      setLiabilities((prev) => [
                        ...prev,
                        { kind: "", where: "", monthly: 0, balance: null },
                      ])
                    }
                  >
                    <Plus size={14} /> שורת התחייבות
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-navy-600 border-b border-navy-100">
                      <th className="py-2 font-medium">סוג</th>
                      <th className="py-2 font-medium">היכן</th>
                      <th className="py-2 font-medium">החזר</th>
                      <th className="py-2 font-medium">יתרה</th>
                      {editingIncome && <th className="py-2 w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {liabilities.map((line, i) => (
                      <tr key={i} className="border-b border-navy-50">
                        {editingIncome ? (
                          <>
                            <td className="py-2 pe-2">
                              <input
                                className="input py-1.5 text-sm"
                                value={line.kind || ""}
                                onChange={(e) =>
                                  setLiabilities((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? { ...x, kind: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 pe-2">
                              <input
                                className="input py-1.5 text-sm"
                                value={line.where || ""}
                                onChange={(e) =>
                                  setLiabilities((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? { ...x, where: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 pe-2">
                              <input
                                className="input py-1.5 text-sm"
                                type="number"
                                dir="ltr"
                                value={line.monthly || ""}
                                onChange={(e) =>
                                  setLiabilities((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            monthly: Number(e.target.value) || 0,
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-2 pe-2">
                              <input
                                className="input py-1.5 text-sm"
                                type="number"
                                dir="ltr"
                                value={line.balance ?? ""}
                                onChange={(e) =>
                                  setLiabilities((prev) =>
                                    prev.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            balance: e.target.value
                                              ? Number(e.target.value)
                                              : null,
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                className="btn-danger p-2"
                                onClick={() =>
                                  setLiabilities((prev) =>
                                    prev.filter((_, idx) => idx !== i)
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5">{line.kind || "—"}</td>
                            <td className="py-2.5">{line.where || "—"}</td>
                            <td className="py-2.5 tabular-nums">
                              {formatILS(line.monthly)}
                            </td>
                            <td className="py-2.5 tabular-nums">
                              {formatILS(line.balance)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {liabilities.length === 0 && (
                      <tr>
                        <td
                          colSpan={editingIncome ? 5 : 4}
                          className="py-4 text-navy-500"
                        >
                          אין שורות התחייבות
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {calcOpen && (
        <div className="modal-backdrop" onClick={() => setCalcOpen(false)}>
          <div
            className="modal max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-heading font-bold text-navy-950 flex items-center gap-2">
                <Calculator size={20} /> חישוב סכום לכל 100,000
              </h3>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCalcOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-navy-600 mb-4">
              חלק את הסכום למסלולים: לכל שורה אחוז מהסכום, שנים וריבית. ההחזר
              הכולל לכל 100,000 הוא סכום ההחזרים המשוקללים (שפיצר).
            </p>

            <div className="space-y-3 mb-4">
              {calcTranches.map((row, idx) => {
                const share = calcBlend?.rows[idx];
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-navy-100 bg-navy-50/40 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-navy-600">
                        מסלול {idx + 1}
                      </span>
                      {calcTranches.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-red-700"
                          onClick={() =>
                            setCalcTranches((prev) =>
                              prev.filter((t) => t.id !== row.id)
                            )
                          }
                        >
                          <Trash2 size={14} /> הסר
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-xs">אחוז מהסכום</label>
                        <input
                          className="input py-2"
                          type="number"
                          dir="ltr"
                          min={0}
                          max={100}
                          step={0.1}
                          value={row.percent}
                          onChange={(e) =>
                            setCalcTranches((prev) =>
                              prev.map((t) =>
                                t.id === row.id
                                  ? { ...t, percent: e.target.value }
                                  : t
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label text-xs">שנים</label>
                        <input
                          className="input py-2"
                          type="number"
                          dir="ltr"
                          min={1}
                          max={40}
                          value={row.years}
                          onChange={(e) =>
                            setCalcTranches((prev) =>
                              prev.map((t) =>
                                t.id === row.id
                                  ? { ...t, years: e.target.value }
                                  : t
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label text-xs">ריבית %</label>
                        <input
                          className="input py-2"
                          type="number"
                          dir="ltr"
                          min={0}
                          step={0.1}
                          value={row.rate}
                          onChange={(e) =>
                            setCalcTranches((prev) =>
                              prev.map((t) =>
                                t.id === row.id
                                  ? { ...t, rate: e.target.value }
                                  : t
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                    {share != null && Number.isFinite(share) && (
                      <p className="text-xs text-navy-500 mt-2">
                        חלק מההחזר: {formatILS(Math.round(share))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-secondary mb-4"
              onClick={() =>
                setCalcTranches((prev) => {
                  const used = prev.reduce(
                    (s, t) => s + (Number(t.percent) || 0),
                    0
                  );
                  const left = Math.max(0, Math.round((100 - used) * 10) / 10);
                  return [
                    ...prev,
                    newTrancheRow({
                      percent: left > 0 ? String(left) : "",
                      years: "",
                      rate: "",
                    }),
                  ];
                })
              }
            >
              <Plus size={16} /> הוסף מסלול
            </button>

            <div className="rounded-xl bg-navy-50 border border-navy-100 p-4 mb-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-navy-600 mb-1">סכום לכל 100,000</p>
                  <p className="text-2xl font-heading font-bold text-navy-950 tabular-nums">
                    {calcPreviewPer100k != null
                      ? formatILS(Math.round(calcPreviewPer100k))
                      : "—"}
                  </p>
                  {calcPreviewPer100k != null && (
                    <p className="text-xs text-navy-500 mt-1" dir="ltr">
                      {calcPreviewPer100k.toFixed(2)} ₪ / חודש
                    </p>
                  )}
                </div>
                <div className="text-sm">
                  <span
                    className={
                      Math.abs(calcPercentSum - 100) <= 0.05
                        ? "text-navy-800 font-semibold"
                        : "text-red-700 font-semibold"
                    }
                  >
                    סה״כ אחוזים: {calcPercentSum.toFixed(1)}%
                  </span>
                  {Math.abs(calcPercentSum - 100) > 0.05 && (
                    <p className="text-xs text-red-600 mt-1">
                      יש להגיע ל־100% לפני שימוש בסכום
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCalcOpen(false)}
              >
                סגור
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  calcPreviewPer100k == null ||
                  Math.abs(calcPercentSum - 100) > 0.05
                }
                onClick={applyCalcToPer100k}
              >
                השתמש בסכום זה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
