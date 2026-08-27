"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Save,
  X,
  Calendar,
  CreditCard,
  User,
  Send,
  Trash2,
  ArrowRight,
  Building2,
  Edit3,
  ShieldCheck,
} from "lucide-react";
import type {
  Association,
  Client,
  Deposit,
  DepositType,
  DepositResponsibility,
  ReminderRecipient,
  ScholarshipDelivery,
  Reminder,
} from "@/lib/db";
import {
  depositTypeLabel,
  depositTypeShortLabel,
  responsibilityLabel,
  reminderRecipientLabel,
  depositTypeDescription,
  defaultResponsibilityFor,
  scholarshipDeliveryLabel,
  depositRequiresPayment,
} from "@/lib/types";
import { depositDocBucket } from "@/lib/deposit-doc-buckets";
import { mergeOpenDocMaps } from "@/lib/deposit-doc-reminders";

interface FormState {
  id?: string;
  clientId: string;
  associationId: string;
  depositType: DepositType;
  responsibility: DepositResponsibility;
  amount: string;
  dayOfMonth: string;
  daysBeforeReminder: string;
  startDate: string;
  endDate: string;
  reminderRecipient: ReminderRecipient;
  notes: string;
  active: boolean;
  scholarshipDelivery: ScholarshipDelivery;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

const emptyForm: FormState = {
  clientId: "",
  associationId: "",
  depositType: "salary_slip",
  responsibility: "advisor",
  amount: "",
  dayOfMonth: "10",
  daysBeforeReminder: "5",
  startDate: todayIso(),
  endDate: "",
  reminderRecipient: "advisor",
  notes: "",
  active: true,
  scholarshipDelivery: "cash",
};

const DAY_TEMPLATES = [5, 10, 15, 20, 25];
const DAYS_BEFORE_TEMPLATES = [3, 5, 7, 10];

export function DepositsTab({
  initialDeposits,
  clients,
  associations,
  reminderMeta,
  openReminders = {},
}: {
  initialDeposits: Deposit[];
  clients: Client[];
  associations: Association[];
  reminderMeta: Record<string, { sends: number; lastSent: string | null }>;
  openReminders?: Record<string, Reminder>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deposits, setDeposits] = useState<Deposit[]>(initialDeposits);
  const [docs, setDocs] = useState<Record<string, Reminder>>(openReminders);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<
    "pending" | "done" | "paid" | "archive"
  >("pending");

  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const associationMap = useMemo(() => {
    const m: Record<string, Association> = {};
    associations.forEach((a) => (m[a.id] = a));
    return m;
  }, [associations]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (
      tab === "pending" ||
      tab === "done" ||
      tab === "paid" ||
      tab === "archive"
    ) {
      setDocTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const newClientId = searchParams?.get("newClientId");
    if (newClientId && clients.some((c) => c.id === newClientId)) {
      setForm({ ...emptyForm, clientId: newClientId });
      setShowForm(true);
      router.replace("/deposits");
    }
  }, [searchParams, clients, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setDocs((prev) => mergeOpenDocMaps(prev, openReminders));
  }, [openReminders]);

  useEffect(() => {
    setDeposits(initialDeposits);
  }, [initialDeposits]);

  function onChangeDepositType(next: DepositType) {
    setForm((f) => ({
      ...f,
      depositType: next,
      // הצעה חכמה של responsibility לפי סוג
      responsibility: defaultResponsibilityFor[next],
      // אם ההצעה היא client → הלקוח מקבל את התזכורת
      reminderRecipient:
        defaultResponsibilityFor[next] === "client" ? "client" : "advisor",
    }));
  }

  function openNew() {
    if (clients.length === 0) {
      setToast("עליך להוסיף לקוחות קודם");
      return;
    }
    setForm({ ...emptyForm, clientId: clients[0].id });
    setShowForm(true);
    setError(null);
  }

  function openEdit(d: Deposit) {
    setForm({
      id: d.id,
      clientId: d.clientId,
      associationId: d.associationId || "",
      depositType: d.depositType,
      responsibility: d.responsibility,
      amount: String(d.amount),
      dayOfMonth: String(d.dayOfMonth),
      daysBeforeReminder: String(d.daysBeforeReminder),
      startDate: d.startDate,
      endDate: d.endDate || "",
      reminderRecipient: d.reminderRecipient,
      notes: d.notes || "",
      active: d.active,
      scholarshipDelivery: d.scholarshipDelivery || "cash",
    });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!form.clientId) throw new Error("יש לבחור לקוח");
      const amount = Number(form.amount);
      if (!isFinite(amount) || amount <= 0) throw new Error("סכום לא תקין");
      const dayOfMonth = Number(form.dayOfMonth);
      if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)
        throw new Error("יום בחודש חייב להיות בין 1 ל-31");
      const daysBefore = Number(form.daysBeforeReminder);
      if (
        !Number.isFinite(daysBefore) ||
        daysBefore < 0 ||
        daysBefore > 30
      )
        throw new Error("מספר ימים לפני התזכורת חייב להיות בין 0 ל-30");
      if (!form.startDate) throw new Error("יש לבחור תאריך התחלה");

      const payload = {
        clientId: form.clientId,
        associationId: form.associationId || null,
        depositType: form.depositType,
        responsibility: form.responsibility,
        amount,
        dayOfMonth,
        daysBeforeReminder: daysBefore,
        startDate: form.startDate,
        endDate: form.endDate || null,
        reminderRecipient: form.reminderRecipient,
        notes: form.notes,
        active: form.active,
        scholarshipDelivery:
          form.depositType === "kollel_scholarship"
            ? form.scholarshipDelivery
            : null,
      };

      const isEdit = Boolean(form.id);
      const res = await fetch(
        isEdit ? `/api/deposits/${form.id}` : "/api/deposits",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שמירה נכשלה");
      }
      const saved: Deposit = await res.json();
      setDeposits((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setShowForm(false);
      setForm(emptyForm);
      setToast(isEdit ? "ההפקדה עודכנה" : "נוצרה הפקדה חדשה");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Deposit) {
    const res = await fetch(`/api/deposits/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    if (res.ok) {
      const updated: Deposit = await res.json();
      setDeposits((prev) => prev.map((x) => (x.id === d.id ? updated : x)));
    }
  }

  async function sendNow(d: Deposit, to: "advisor" | "client" = "advisor") {
    const res = await fetch(`/api/deposits/${d.id}/send-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      setToast(
        to === "client"
          ? `נשלחה תזכורת ללקוח ${clientMap[d.clientId]?.name || ""}`
          : `נשלחה תזכורת ליועץ`
      );
      void j;
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "שליחה נכשלה"}`);
    }
  }

  async function ensureDocReminder(depositId: string): Promise<Reminder | null> {
    const existing = docs[depositId];
    if (existing) return existing;
    const res = await fetch(`/api/deposits/${depositId}/ensure-doc`, {
      method: "POST",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "פתיחת תיעוד נכשלה"}`);
      return null;
    }
    const j = await res.json();
    const rem = j.reminder as Reminder;
    setDocs((prev) => ({ ...prev, [depositId]: rem }));
    return rem;
  }

  async function markDocAction(depositId: string, reminderId?: string) {
    let rem: Reminder | null | undefined =
      (reminderId && docs[depositId]?.id === reminderId
        ? docs[depositId]
        : null) || docs[depositId];
    if (!rem) {
      rem = await ensureDocReminder(depositId);
    }
    if (!rem) return;
    const rid = rem.id;
    const now = new Date().toISOString();
    const dep = deposits.find((d) => d.id === depositId);
    const next = { ...rem, actionDoneAt: now };
    if (dep) {
      setDocs((prev) => ({ ...prev, [depositId]: next }));
      setDocTab(docBucket(dep, next));
    }
    const res = await fetch(`/api/reminders/${rid}/action-done`, {
      method: "POST",
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.reminder && dep) {
        setDocs((prev) => ({ ...prev, [depositId]: j.reminder }));
        setDocTab(docBucket(dep, j.reminder));
      }
      setToast("סומן כבוצע");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "סימון נכשל"}`);
      router.refresh();
    }
  }

  async function markDocPaid(depositId: string, reminderId?: string) {
    let rem: Reminder | null | undefined =
      (reminderId && docs[depositId]?.id === reminderId
        ? docs[depositId]
        : null) || docs[depositId];
    if (!rem) {
      rem = await ensureDocReminder(depositId);
    }
    if (!rem) return;
    const rid = rem.id;
    const now = new Date().toISOString();
    const dep = deposits.find((d) => d.id === depositId);
    const next = { ...rem, paymentDoneAt: now, paidAt: now };
    if (dep) {
      setDocs((prev) => ({ ...prev, [depositId]: next }));
      setDocTab(docBucket(dep, next));
    }
    const res = await fetch(`/api/reminders/${rid}/mark-paid`, {
      method: "POST",
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.reminder && dep) {
        setDocs((prev) => ({ ...prev, [depositId]: j.reminder }));
        setDocTab(docBucket(dep, j.reminder));
      }
      setToast("סומן כשולם");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "סימון נכשל"}`);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את ההפקדה? הפעולה תמחק גם את כל התזכורות שלה.")) return;
    const res = await fetch(`/api/deposits/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeposits((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    }
  }

  function docBucket(
    d: Deposit,
    rem: Reminder | undefined
  ): "pending" | "done" | "paid" | "archive" {
    return depositDocBucket(d.depositType, rem);
  }

  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => docBucket(d, docs[d.id]) === docTab);
  }, [deposits, docs, docTab]);

  const tabCounts = useMemo(() => {
    const c = { pending: 0, done: 0, paid: 0, archive: 0 };
    for (const d of deposits) {
      c[docBucket(d, docs[d.id])]++;
    }
    return c;
  }, [deposits, docs]);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-bold text-white"
          style={{
            background:
              "linear-gradient(135deg, #3fbfaf 0%, #369989 55%, #265f58 100%)",
            boxShadow: "0 20px 40px -10px rgba(54,153,137,0.5)",
          }}
        >
          {toast}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="section-title mb-2">הפקדות</h1>
          <p className="section-subtitle">
            ניהול הפקדות חוזרות, תיעוד חודשי, ותזכורות ליועץ וללקוח
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={openNew}>
          <Plus size={18} /> הוספת הפקדה
        </button>
      </div>

      <div
        className="tabs-scroll"
        role="tablist"
        aria-label="סינון לפי תיעוד"
      >
        {(
          [
            { key: "pending" as const, label: "ממתינות" },
            { key: "done" as const, label: "בוצעו" },
            { key: "paid" as const, label: "שולמו" },
            { key: "archive" as const, label: "ארכיון" },
          ]
        ).map((t) => {
          const active = docTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDocTab(t.key)}
              className={`tab-filter ${active ? "tab-filter-active" : ""}`}
            >
              {t.label}{" "}
              <span className="tab-filter-count">({tabCounts[t.key]})</span>
            </button>
          );
        })}
      </div>

      {clients.length === 0 && (
        <div className="card mb-6 border-amber-500/40 bg-amber-50">
          <p className="text-amber-800">
            אין עדיין לקוחות במערכת. עבור ללשונית &quot;לקוחות&quot; והוסף לקוח כדי להתחיל
            להוסיף הפקדות.
          </p>
        </div>
      )}

      {filteredDeposits.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex p-5 rounded-2xl bg-navy-50 border border-navy-100 mb-4">
            <CreditCard size={32} className="text-navy-700" />
          </div>
          <h3 className="text-xl font-heading font-bold text-navy-950 mb-2">
            אין הפקדות בלשונית זו
          </h3>
          <p className="text-navy-700">
            {deposits.length === 0
              ? "הוסף הפקדה ראשונה כדי להתחיל"
              : "כשתסמן בוצע / שולם — ההפקדה תעבור לכאן"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDeposits.map((d) => {
            const client = clientMap[d.clientId];
            const assoc = d.associationId ? associationMap[d.associationId] : null;
            const meta = reminderMeta[d.id];
            const rem = docs[d.id];
            const needsPay = depositRequiresPayment(d.depositType);
            const actionDone = !!rem?.actionDoneAt;
            const paidDone = !!(rem?.paymentDoneAt || rem?.paidAt);
            return (
              <div key={d.id} className="card">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="chip">
                        <User size={12} /> {client?.name || "לקוח לא ידוע"}
                      </span>
                      <span className="chip chip-blue">
                        {depositTypeLabel[d.depositType]}
                      </span>
                      <span
                        className={`chip ${
                          d.responsibility === "advisor"
                            ? "chip-gold"
                            : "chip-purple"
                        }`}
                      >
                        <ShieldCheck size={12} />
                        {responsibilityLabel[d.responsibility]}
                      </span>
                      <span className="chip chip-amber">
                        תזכורת ל: {reminderRecipientLabel[d.reminderRecipient]}
                      </span>
                      {assoc && (
                        <span className="case-meta">
                          <Building2 size={12} /> {assoc.name}
                        </span>
                      )}
                      {!d.active && <span className="chip chip-red">כבוי</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-navy-700">
                      <span className="text-2xl font-heading font-black gradient-text-gold">
                        {new Intl.NumberFormat("he-IL", {
                          style: "currency",
                          currency: "ILS",
                          maximumFractionDigits: 0,
                        }).format(d.amount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} className="text-teal-600" />
                        יום {d.dayOfMonth} בחודש · {d.daysBeforeReminder} ימים
                        לפני
                      </span>
                      <span className="text-navy-500 text-xs">
                        תקופה: {d.startDate}
                        {d.endDate ? ` → ${d.endDate}` : " → פתוח"}
                      </span>
                      {rem && (
                        <span className="text-navy-500 text-xs">
                          יעד החודש:{" "}
                          {new Date(rem.targetDate).toLocaleDateString("he-IL")}
                        </span>
                      )}
                      {meta && meta.sends > 0 && (
                        <span className="text-navy-500 text-xs">
                          נשלחו {meta.sends} תזכורות
                        </span>
                      )}
                    </div>
                    {d.notes && (
                      <div className="mt-2 text-xs text-navy-500 whitespace-pre-wrap">
                        {d.notes}
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="text-xs font-bold tracking-wide text-navy-600 mb-2">
                        תיעוד החודש
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {actionDone ? (
                          <span className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-500/25">
                            בוצע
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center px-5 py-2.5 rounded-xl border-2 border-emerald-500/50 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-500 hover:text-white transition-colors"
                            onClick={() =>
                              void markDocAction(d.id, rem?.id)
                            }
                          >
                            סמן כבוצע
                          </button>
                        )}
                        {needsPay &&
                          (paidDone ? (
                            <span className="inline-flex items-center px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-md shadow-amber-500/25">
                              שולם
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center px-5 py-2.5 rounded-xl border-2 border-amber-500/50 bg-amber-50 text-amber-900 text-sm font-bold hover:bg-amber-500 hover:text-white transition-colors"
                              onClick={() =>
                                void markDocPaid(d.id, rem?.id)
                              }
                            >
                              סמן כשולם
                            </button>
                          ))}
                      </div>
                      {!rem && (
                        <p className="text-xs text-navy-500 mt-2">
                          עדיין לא נפתחה תזכורת אוטומטית — סימון בוצע/שולם יפתח
                          תיעוד לחודש הנוכחי עכשיו.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-xs text-navy-600 font-medium">
                        {d.active ? "פעיל" : "כבוי"}
                      </span>
                      <span
                        className={`toggle ${d.active ? "on" : ""}`}
                        onClick={() => toggleActive(d)}
                      />
                    </label>
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => sendNow(d, "advisor")}
                      disabled={!d.active}
                      title="שליחה מיידית ליועץ — ללא הגבלה"
                    >
                      <Send size={14} /> שלח ליועץ
                    </button>
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => sendNow(d, "client")}
                      disabled={!d.active}
                      title="שליחה מיידית ללקוח — ללא הגבלה"
                    >
                      <Send size={14} /> שלח ללקוח
                    </button>
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => openEdit(d)}
                      title="עריכת ההפקדה"
                    >
                      <Edit3 size={14} /> עריכה
                    </button>
                    <button className="btn-danger" onClick={() => remove(d.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                {form.id ? "עריכת הפקדה" : "הוספת הפקדה"}
              </h2>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {/* לקוח */}
              <div>
                <label className="label">בחירת לקוח *</label>
                <select
                  className="select"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                >
                  <option value="" disabled>
                    בחר לקוח...
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* סוג הפקדה */}
              <div>
                <label className="label">סוג הפקדה *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      "salary_slip",
                      "kollel_scholarship",
                      "private_transfer",
                      "cash_check",
                    ] as DepositType[]
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onChangeDepositType(t)}
                      className={`text-right p-3 rounded-xl border transition-all ${
                        form.depositType === t
                          ? "bg-gold-100/70 border-gold-400/70 text-navy-950 shadow-sm"
                          : "bg-white border-navy-950/10 text-navy-800 hover:border-teal-500/50"
                      }`}
                    >
                      <div className="font-bold text-sm">
                        {depositTypeLabel[t]}
                      </div>
                      <div className="text-[11px] opacity-70 mt-0.5">
                        {depositTypeDescription[t]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* אחריות */}
              <div>
                <label className="label">אחריות על ההפקדה *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["advisor", "client"] as DepositResponsibility[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, responsibility: r })
                      }
                      className={`p-3 rounded-2xl border transition-all text-sm font-medium ${
                        form.responsibility === r
                          ? "bg-navy-950 text-white border-navy-950"
                          : "bg-white border-navy-950/15 text-navy-800 hover:border-navy-950/35"
                      }`}
                    >
                      {responsibilityLabel[r]}
                    </button>
                  ))}
                </div>
                {form.responsibility === "advisor" ? (
                  <div className="mt-2 text-xs text-gold-700">
                    ⓘ אתה מפיק את התלוש/המילגה/ההעברה. המערכת תשלח לך תזכורת
                    לביצוע ואחר-כך תזכורת לוודא שהלקוח שילם. אם לא סימנת &quot;שולם&quot;
                    תוך 3 ימים — הלקוח יקבל תזכורת ישירה.
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-navy-600">
                    ⓘ הלקוח מפקיד בעצמו. הוא יקבל תזכורת ומעלה עובר-ושב שיישלח
                    אליך אוטומטית.
                  </div>
                )}
              </div>

              {/* עמותה */}
              <div>
                <label className="label">עמותה (אופציונלי)</label>
                <select
                  className="select"
                  value={form.associationId}
                  onChange={(e) =>
                    setForm({ ...form, associationId: e.target.value })
                  }
                >
                  <option value="">ללא עמותה</option>
                  {associations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.bankNumber && a.branchNumber && a.accountNumber
                        ? ` · בנק ${a.bankNumber}/${a.branchNumber}/${a.accountNumber}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* סכום */}
              <div>
                <label className="label">סכום *</label>
                <input
                  type="number"
                  className="input"
                  value={form.amount}
                  min="0"
                  step="any"
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="לדוגמה: 3000"
                />
              </div>

              {/* יום בחודש */}
              <div>
                <label className="label">יום ההפקדה בחודש (1-31) *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  dir="ltr"
                  value={form.dayOfMonth}
                  onChange={(e) =>
                    setForm({ ...form, dayOfMonth: e.target.value })
                  }
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-navy-600 self-center font-medium">
                    מהיר:
                  </span>
                  {DAY_TEMPLATES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, dayOfMonth: String(d) })
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                        Number(form.dayOfMonth) === d
                          ? "bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 shadow-sm"
                          : "bg-white text-navy-700 border border-navy-950/12 hover:border-teal-500/50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* ימים לפני התזכורת */}
              <div>
                <label className="label">כמה ימים לפני לשלוח תזכורת *</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={30}
                  dir="ltr"
                  value={form.daysBeforeReminder}
                  onChange={(e) =>
                    setForm({ ...form, daysBeforeReminder: e.target.value })
                  }
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS_BEFORE_TEMPLATES.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, daysBeforeReminder: String(d) })
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
                        Number(form.daysBeforeReminder) === d
                          ? "bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 shadow-sm"
                          : "bg-white text-navy-700 border border-navy-950/12 hover:border-teal-500/50"
                      }`}
                    >
                      {d} ימים
                    </button>
                  ))}
                </div>
              </div>

              {form.depositType === "kollel_scholarship" && (
                <div>
                  <label className="label">אופן מילגה בתזכורת ללקוח</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["cash", "transfer"] as ScholarshipDelivery[]).map(
                      (m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setForm({ ...form, scholarshipDelivery: m })
                          }
                          className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
                            form.scholarshipDelivery === m
                              ? "bg-gold-100 border-gold-400/80 text-navy-950 shadow-sm"
                              : "bg-white border-navy-950/10 text-navy-800 hover:border-teal-500/50"
                          }`}
                        >
                          {scholarshipDeliveryLabel[m]}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* למי לשלוח */}
              <div>
                <label className="label">למי לשלוח את התזכורת *</label>
                <p className="text-xs text-navy-600 mb-2">
                  שליחה אוטומטית היא ליועץ בלבד. שליחה ללקוח מתבצעת ידנית ממסך
                  התזכורות.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(["advisor", "client", "both"] as ReminderRecipient[]).map(
                    (r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, reminderRecipient: r })
                        }
                        className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form.reminderRecipient === r
                            ? "bg-gold-100 border-gold-400/80 text-navy-950 shadow-sm"
                            : "bg-white border-navy-950/10 text-navy-800 hover:border-teal-500/50"
                        }`}
                      >
                        {reminderRecipientLabel[r]}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* תקופה */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך התחלה *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">תאריך סיום (לא חובה)</label>
                  <input
                    type="date"
                    className="input"
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* הערות */}
              <div>
                <label className="label">הערות (לא חובה)</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {form.id && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-gold-500"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  <span className="text-navy-800">הפקדה פעילה</span>
                </label>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary flex-1"
                  onClick={save}
                  disabled={saving}
                >
                  <Save size={18} />
                  {saving ? "שומר..." : "שמירה"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  <ArrowRight size={16} /> ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
