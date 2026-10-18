"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Save,
  X,
  Send,
  Trash2,
  ArrowRight,
  Edit3,
  Search,
  Download,
  GripVertical,
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
  depositShowsPayerField,
} from "@/lib/types";
import {
  depositDocBucket,
  type DepositDocBucket,
} from "@/lib/deposit-doc-buckets";
import { listMonthDocReminders } from "@/lib/deposit-doc-reminders";

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

function currentMonthBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function formatMonthBucket(bucket: string): string {
  const [ys, ms] = bucket.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return bucket;
  return new Date(y, m - 1, 1).toLocaleDateString("he-IL", {
    month: "long",
    year: "numeric",
  });
}

function monthGroups(rows: { deposit: Deposit; reminder: Reminder | null }[]) {
  const by = new Map<string, { deposit: Deposit; reminder: Reminder | null }[]>();
  for (const row of rows) {
    const bucket = row.reminder?.monthBucket || "0000-00";
    const list = by.get(bucket) || [];
    list.push(row);
    by.set(bucket, list);
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([bucket, list]) => ({ bucket, rows: list }));
}

function monthCode(bucket: string | null | undefined): string {
  if (!bucket || !/^\d{4}-\d{2}$/.test(bucket)) return "";
  const [year, month] = bucket.split("-");
  return `${Number(month)}/${year}`;
}

function depositUrgency(
  targetDate: string | null | undefined,
  open: boolean
): "urgent" | "critical" | null {
  if (!open || !targetDate) return null;
  const target = new Date(`${targetDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < target) return null;
  if (today.getTime() === target.getTime()) return "urgent";
  return "critical";
}

const SECTION_TONE: Record<
  string,
  { bar: string; title: string; dot: string; count: string }
> = {
  pending: {
    bar: "bg-amber-50",
    title: "text-amber-950",
    dot: "bg-amber-500",
    count: "bg-amber-500 text-white",
  },
  done: {
    bar: "bg-teal-50",
    title: "text-teal-900",
    dot: "bg-teal-600",
    count: "bg-teal-600 text-white",
  },
  paid: {
    bar: "bg-gold-50",
    title: "text-gold-800",
    dot: "bg-gold-600",
    count: "bg-gold-600 text-white",
  },
  archive: {
    bar: "bg-navy-50",
    title: "text-navy-950",
    dot: "bg-navy-800",
    count: "bg-navy-950 text-white",
  },
  inactive: {
    bar: "bg-slate-100",
    title: "text-slate-600",
    dot: "bg-slate-400",
    count: "bg-slate-500 text-white",
  },
};

function money(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusMark({
  label,
  on,
  tone,
  onClick,
}: {
  label: string;
  on: boolean;
  tone: "teal" | "gold";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? `בטל ${label}` : `סמן ${label}`}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-bold leading-none transition-colors ${
        on
          ? tone === "gold"
            ? "border-amber-500 bg-amber-500 text-white"
            : "border-teal-600 bg-teal-600 text-white"
          : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${
          on ? "border-white/80 bg-white/15" : "border-current"
        }`}
        aria-hidden
      >
        {on && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2.2 6.2 4.7 8.8 9.8 3.2" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

function PayerCell({
  depositId,
  reminderId,
  value,
  onSaved,
  onError,
}: {
  depositId: string;
  reminderId?: string;
  value: string;
  onSaved: (reminder: Reminder) => void;
  onError: (message: string) => void;
}) {
  const saved = (value || "").trim();
  const [text, setText] = useState(saved);
  const [editing, setEditing] = useState(!saved);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusOnEdit = useRef(false);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setText(value || "");
    if ((value || "").trim()) setEditing(false);
  }, [value, reminderId]);

  useEffect(() => {
    if (editing && focusOnEdit.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
      focusOnEdit.current = false;
    }
  }, [editing]);

  async function save() {
    const next = text.trim();
    if (next === saved) {
      setEditing(!next);
      return;
    }
    setSaving(true);
    try {
      let id = reminderId;
      if (!id) {
        const opened = await fetch(`/api/deposits/${depositId}/ensure-doc`, {
          method: "POST",
        });
        const openedJson = await opened.json().catch(() => ({}));
        if (!opened.ok || !openedJson.reminder) {
          onError(openedJson.error || "לא נפתחה שורת חודש");
          setText(saved);
          return;
        }
        id = openedJson.reminder.id as string;
        onSaved(openedJson.reminder as Reminder);
      }
      const res = await fetch(`/api/reminders/${id}/payer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerName: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.reminder) {
        onSaved(j.reminder as Reminder);
        setText(next);
        setEditing(!next);
      } else {
        onError(j.error || "שמירת שם המעביר נכשלה");
        setText(saved);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!editing && saved) {
    return (
      <button
        type="button"
        title="לחץ לעריכה"
        onClick={() => {
          focusOnEdit.current = true;
          setText(saved);
          setEditing(true);
        }}
        className="h-8 max-w-[12rem] truncate rounded-lg border border-transparent bg-slate-100 px-2.5 text-sm font-semibold text-navy-950 hover:border-teal-400 hover:bg-white"
      >
        {saved}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={text}
      aria-label="שם המעביר"
      placeholder="שם מעביר"
      title={saving ? "שומר..." : "נשמר על החודש הזה"}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setText(saved);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={`h-8 w-full min-w-[7.5rem] rounded-lg border bg-white px-2 text-sm text-navy-950 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
        saving ? "border-teal-400" : "border-slate-200"
      }`}
    />
  );
}

export function DepositsTab({
  initialDeposits,
  clients,
  associations,
  reminderMeta,
  monthReminders = [],
}: {
  initialDeposits: Deposit[];
  clients: Client[];
  associations: Association[];
  reminderMeta: Record<string, { sends: number; lastSent: string | null }>;
  monthReminders?: Reminder[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deposits, setDeposits] = useState<Deposit[]>(initialDeposits);
  const [docs, setDocs] = useState<Record<string, Reminder>>(() =>
    Object.fromEntries(monthReminders.map((r) => [r.id, r]))
  );
  const [nameQuery, setNameQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [payerQuery, setPayerQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    "date" | "client" | "type" | "association" | "payer" | "amount"
  >("date");
  const [exportAssociationId, setExportAssociationId] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dragPayload = useRef<{
    depositId: string;
    reminderId?: string;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState<DepositDocBucket | null>(null);

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
    if (!tab) return;
    const el = document.getElementById(`deposit-section-${tab}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    setDocs((prev) => {
      const next = { ...prev };
      const incomingIds = new Set(monthReminders.map((r) => r.id));
      for (const id of Object.keys(next)) {
        if (!incomingIds.has(id)) delete next[id];
      }
      for (const r of monthReminders) next[r.id] = r;
      return next;
    });
  }, [monthReminders]);

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

  async function sendAssociationDigest() {
    if (!exportAssociationId) {
      setToast("בחר עמותה מהרשימה, ואז שלח את ההתראה");
      return;
    }
    setSendingDigest(true);
    try {
      const res = await fetch(
        `/api/associations/${exportAssociationId}/pending-digest`,
        { method: "POST" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(j.error || "השליחה נכשלה");
        return;
      }
      const name =
        associationMap[exportAssociationId]?.name || "העמותה";
      setToast(`נשלחה התראה אל ${name} (${j.count} שורות)`);
    } finally {
      setSendingDigest(false);
    }
  }

  async function sendNow(
    d: Deposit,
    to: "advisor" | "client" = "advisor",
    reminderId?: string
  ) {
    const res = await fetch(`/api/deposits/${d.id}/send-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, reminderId }),
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
    const bucket = currentMonthBucket();
    const existing = Object.values(docs).find(
      (r) => r.depositId === depositId && r.monthBucket === bucket
    );
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
    setDocs((prev) => ({ ...prev, [rem.id]: rem }));
    return rem;
  }

  async function setDocFlag(
    depositId: string,
    reminderId: string | undefined,
    field: "action" | "paid",
    on: boolean
  ) {
    const found = reminderId ? docs[reminderId] : undefined;
    const rem = found ?? (await ensureDocReminder(depositId));
    if (!rem) return;
    const now = new Date().toISOString();
    const optimistic: Reminder =
      field === "action"
        ? { ...rem, actionDoneAt: on ? now : null }
        : { ...rem, paymentDoneAt: on ? now : null, paidAt: on ? now : null };
    setDocs((prev) => ({ ...prev, [rem.id]: optimistic }));
    const path = field === "action" ? "action-done" : "mark-paid";
    const res = await fetch(`/api/reminders/${rem.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.reminder) {
        setDocs((prev) => ({ ...prev, [rem.id]: j.reminder }));
      }
      setToast(
        field === "action"
          ? on
            ? "סומן כבוצע"
            : "בוטל סימון בוצע"
          : on
            ? "סומן כשולם"
            : "בוטל סימון שולם"
      );
      router.refresh();
    } else {
      setDocs((prev) => ({ ...prev, [rem.id]: rem }));
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "עדכון נכשל"}`);
    }
  }

  async function moveToBucket(
    depositId: string,
    reminderId: string | undefined,
    target: DepositDocBucket
  ) {
    const deposit = deposits.find((d) => d.id === depositId);
    if (!deposit || !deposit.active) return;
    const found = reminderId ? docs[reminderId] : undefined;
    const rem = found ?? (await ensureDocReminder(depositId));
    if (!rem) return;
    const needsPay = depositRequiresPayment(deposit.depositType);
    const wantAction =
      target === "done" ||
      target === "archive" ||
      (target === "paid" && !needsPay);
    const wantPaid = needsPay && (target === "paid" || target === "archive");
    const curAction = !!rem.actionDoneAt;
    const curPaid = !!(rem.paymentDoneAt || rem.paidAt);
    if (curAction === wantAction && (!needsPay || curPaid === wantPaid)) return;
    const now = new Date().toISOString();
    const optimistic: Reminder = {
      ...rem,
      actionDoneAt: wantAction ? rem.actionDoneAt || now : null,
      paymentDoneAt: needsPay
        ? wantPaid
          ? rem.paymentDoneAt || rem.paidAt || now
          : null
        : rem.paymentDoneAt,
      paidAt: needsPay
        ? wantPaid
          ? rem.paidAt || rem.paymentDoneAt || now
          : null
        : rem.paidAt,
    };
    setDocs((prev) => ({ ...prev, [rem.id]: optimistic }));
    const post = async (path: "action-done" | "mark-paid", on: boolean) => {
      const res = await fetch(`/api/reminders/${rem.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "עדכון נכשל");
      return (j.reminder as Reminder | undefined) ?? null;
    };
    try {
      let latest: Reminder = optimistic;
      if (curAction !== wantAction) {
        const saved = await post("action-done", wantAction);
        if (saved) latest = saved;
      }
      if (needsPay && curPaid !== wantPaid) {
        const saved = await post("mark-paid", wantPaid);
        if (saved) latest = { ...latest, ...saved };
      }
      setDocs((prev) => ({ ...prev, [rem.id]: latest }));
      const landed = depositDocBucket(deposit.depositType, latest);
      const titles: Record<DepositDocBucket, string> = {
        pending: "ממתינות",
        done: "בוצעו",
        paid: "שולמו",
        archive: "ארכיון",
      };
      setToast(
        landed !== target && target !== "pending"
          ? "בסוג הזה אין שולם נפרד. השורה עברה לארכיון"
          : `השורה עברה אל ${titles[landed]}`
      );
      router.refresh();
    } catch (err) {
      setDocs((prev) => ({ ...prev, [rem.id]: rem }));
      setToast(
        `שגיאה: ${err instanceof Error ? err.message : "עדכון נכשל"}`
      );
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
    rem: Reminder | null | undefined
  ): "pending" | "done" | "paid" | "archive" {
    return depositDocBucket(d.depositType, rem);
  }

  const monthRows = useMemo(() => {
    const byDeposit: Record<string, Reminder[]> = {};
    for (const r of Object.values(docs)) {
      (byDeposit[r.depositId] ||= []).push(r);
    }
    const rows: { deposit: Deposit; reminder: Reminder | null }[] = [];
    for (const d of deposits) {
      const months = listMonthDocReminders(byDeposit[d.id] || []);
      if (months.length === 0) rows.push({ deposit: d, reminder: null });
      else for (const reminder of months) rows.push({ deposit: d, reminder });
    }
    rows.sort((a, b) => {
      const ad = a.reminder?.targetDate || "0000";
      const bd = b.reminder?.targetDate || "0000";
      if (ad !== bd) return ad < bd ? 1 : -1;
      const an = clientMap[a.deposit.clientId]?.name || "";
      const bn = clientMap[b.deposit.clientId]?.name || "";
      return an.localeCompare(bn, "he");
    });
    return rows;
  }, [deposits, docs, clientMap]);

  const visibleRows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const pq = payerQuery.trim().toLowerCase();
    const filtered = monthRows.filter((row) => {
      const clientName = clientMap[row.deposit.clientId]?.name || "";
      const assocName = row.deposit.associationId
        ? associationMap[row.deposit.associationId]?.name || ""
        : "";
      const payer = row.reminder?.payerName || "";
      const typeLabel = depositTypeLabel[row.deposit.depositType];
      if (clientFilter && row.deposit.clientId !== clientFilter) return false;
      if (typeFilter && row.deposit.depositType !== typeFilter) return false;
      if (
        exportAssociationId &&
        row.deposit.associationId !== exportAssociationId
      ) {
        return false;
      }
      if (pq && !payer.toLowerCase().includes(pq)) return false;
      if (q) {
        const hay = `${clientName} ${assocName} ${payer} ${typeLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sortValue = (row: (typeof filtered)[number]) => {
      switch (sortKey) {
        case "client":
          return clientMap[row.deposit.clientId]?.name || "";
        case "type":
          return depositTypeLabel[row.deposit.depositType];
        case "association":
          return row.deposit.associationId
            ? associationMap[row.deposit.associationId]?.name || ""
            : "";
        case "payer":
          return row.reminder?.payerName || "";
        case "amount":
          return String(row.deposit.amount).padStart(12, "0");
        default:
          return row.reminder?.targetDate || "0000";
      }
    };
    filtered.sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (av === bv) {
        const an = clientMap[a.deposit.clientId]?.name || "";
        const bn = clientMap[b.deposit.clientId]?.name || "";
        return an.localeCompare(bn, "he");
      }
      if (sortKey === "date" || sortKey === "amount") return av < bv ? 1 : -1;
      return av.localeCompare(bv, "he");
    });
    return filtered;
  }, [
    monthRows,
    nameQuery,
    payerQuery,
    clientFilter,
    typeFilter,
    exportAssociationId,
    sortKey,
    clientMap,
    associationMap,
  ]);

  const sections = useMemo(() => {
    const order = [
      {
        key: "pending",
        title: "ממתינות",
        hint: "",
        group: false,
      },
      {
        key: "done",
        title: "בוצעו",
        hint: "",
        group: false,
      },
      {
        key: "paid",
        title: "שולמו",
        hint: "",
        group: false,
      },
      {
        key: "archive",
        title: "ארכיון",
        hint: "",
        group: true,
      },
      {
        key: "inactive",
        title: "כבויות",
        hint: "",
        group: true,
      },
    ] as const;
    return order
      .map((section) => ({
        ...section,
        rows: visibleRows.filter((row) =>
          section.key === "inactive"
            ? !row.deposit.active
            : row.deposit.active &&
              docBucket(row.deposit, row.reminder) === section.key
        ),
      }));
  }, [visibleRows]);

  return (
    <div className="page-shell animate-fade-in">
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
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="section-title mb-1">הפקדות</h1>
          <p className="section-subtitle">
            שורה לכל חודש. גרור שורה אל סטטוס, או סמן בוצע ושולם בתיבה.
          </p>
        </div>
        <button
          className="btn-primary shrink-0 whitespace-nowrap px-5"
          onClick={openNew}
        >
          <Plus size={18} /> הוספת הפקדה
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search
              size={15}
              className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none"
            />
            <input
              className="input !py-2 pr-9 text-sm"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="חיפוש לקוח, סוג, עמותה או מעביר"
            />
          </div>
          <select
            className="select !py-2 text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="סינון לפי לקוח"
          >
            <option value="">כל הלקוחות</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="select !py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="סינון לפי סוג"
          >
            <option value="">כל הסוגים</option>
            {(
              [
                "salary_slip",
                "kollel_scholarship",
                "private_transfer",
                "cash_check",
              ] as DepositType[]
            ).map((t) => (
              <option key={t} value={t}>
                {depositTypeLabel[t]}
              </option>
            ))}
          </select>
          <select
            className="select !py-2 text-sm"
            value={exportAssociationId}
            onChange={(e) => setExportAssociationId(e.target.value)}
            aria-label="סינון לפי עמותה"
          >
            <option value="">כל העמותות</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            className="select !py-2 text-sm"
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as typeof sortKey)
            }
            aria-label="מיון"
          >
            <option value="date">מיון לפי תאריך</option>
            <option value="client">מיון לפי לקוח</option>
            <option value="type">מיון לפי סוג</option>
            <option value="association">מיון לפי עמותה</option>
            <option value="payer">מיון לפי מעביר</option>
            <option value="amount">מיון לפי סכום</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className="input !py-2 text-sm max-w-xs"
            value={payerQuery}
            onChange={(e) => setPayerQuery(e.target.value)}
            placeholder="סינון לפי שם מעביר"
            aria-label="סינון לפי שם מעביר"
          />
          <a
            className="btn-secondary text-sm justify-center whitespace-nowrap"
            href={`/api/deposits/payers-export${
              exportAssociationId
                ? `?associationId=${encodeURIComponent(exportAssociationId)}`
                : ""
            }`}
          >
            <Download size={16} /> אקסל מפורט
          </a>
          <button
            className="btn-secondary text-sm justify-center shrink-0 whitespace-nowrap"
            onClick={() => void sendAssociationDigest()}
            disabled={sendingDigest}
            title="מייל אחד לעמותה שנבחרה בסינון"
          >
            <Send size={16} />
            {sendingDigest ? "שולח..." : "שלח התראה לעמותה"}
          </button>
        </div>
      </div>

      {clients.length === 0 && (
        <div className="card mb-6 border-amber-500/40 bg-amber-50">
          <p className="text-amber-800">
            אין עדיין לקוחות במערכת. עבור ללשונית &quot;לקוחות&quot; והוסף לקוח כדי להתחיל
            להוסיף הפקדות.
          </p>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white text-center py-14">
          <h3 className="text-lg font-heading font-bold text-navy-950 mb-1">
            אין שורות להצגה
          </h3>
          <p className="text-sm text-slate-500">
            {nameQuery.trim() || payerQuery.trim() || clientFilter || typeFilter || exportAssociationId
              ? "אין הפקדות שתואמות לסינון"
              : deposits.length === 0
                ? "הוסף הפקדה ראשונה כדי להתחיל"
                : "כשתסמן בוצע ושולם, השורה תרד לארכיון"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections
            .filter(
              (section) =>
                section.key !== "inactive" || section.rows.length > 0
            )
            .map((section) => {
            const groups = section.group
              ? monthGroups(section.rows)
              : [{ bucket: "", rows: section.rows }];
            const tone = SECTION_TONE[section.key] || SECTION_TONE.archive;
            const isOver = dropTarget === section.key;
            return (
              <section
                key={section.key}
                id={`deposit-section-${section.key}`}
                onDragEnter={(e) => {
                  if (section.key === "inactive" || !dragPayload.current) return;
                  e.preventDefault();
                  setDropTarget(section.key as DepositDocBucket);
                }}
                onDragOver={(e) => {
                  if (section.key === "inactive" || !dragPayload.current) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget((cur) =>
                    cur === section.key ? cur : (section.key as DepositDocBucket)
                  );
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTarget((cur) =>
                    cur === section.key ? null : cur
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const payload = dragPayload.current;
                  dragPayload.current = null;
                  setDragging(false);
                  setDropTarget(null);
                  if (!payload || section.key === "inactive") return;
                  void moveToBucket(
                    payload.depositId,
                    payload.reminderId,
                    section.key
                  );
                }}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                  isOver
                    ? "border-teal-500 ring-2 ring-teal-400"
                    : "border-slate-200"
                }`}
              >
                <header
                  className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${
                    isOver
                      ? "border-teal-600 bg-teal-600"
                      : `border-slate-200 ${tone.bar}`
                  }`}
                >
                  <h2
                    className={`flex items-center gap-2 font-sans text-base font-bold ${
                      isOver ? "!text-white" : tone.title
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isOver ? "bg-white" : tone.dot
                      }`}
                    />
                    {isOver ? `שחרר כאן · ${section.title}` : section.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <a
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                        isOver
                          ? "border-white/40 text-white hover:bg-white/10"
                          : "border-navy-950/15 text-navy-800 hover:bg-white"
                      }`}
                      href={`/api/deposits/payers-export?section=${section.key}${
                        exportAssociationId
                          ? `&associationId=${encodeURIComponent(exportAssociationId)}`
                          : ""
                      }`}
                    >
                      אקסל
                    </a>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        isOver ? "bg-white/20 text-white" : tone.count
                      }`}
                    >
                      {section.rows.length}
                    </span>
                  </div>
                </header>
                {section.rows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-500">
                    {dragging
                      ? `שחרר כאן כדי להעביר אל ${section.title}`
                      : "אין שורות. אפשר לגרור לכאן."}
                  </p>
                ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-navy-950 text-[11px] font-semibold text-white">
                        <th className="w-8 px-2 py-2 font-semibold text-white" aria-label="גרירה" />
                        <th className="px-3 py-2 text-right font-semibold text-white">לקוח</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">חודש הפקדה</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">סוג</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">עמותה</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">מעביר</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">סכום</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">יעד</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">סטטוס</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">פעולות</th>
                      </tr>
                    </thead>
                    {groups.map((group) => (
                      <tbody key={`${section.key}-${group.bucket || "all"}`}>
                        {section.group && (
                          <tr className="bg-slate-100/80">
                            <td
                              colSpan={10}
                              className="px-3 py-2 text-sm font-black text-navy-950"
                            >
                              {group.bucket === "0000-00"
                                ? "בלי חודש"
                                : formatMonthBucket(group.bucket)}
                            </td>
                          </tr>
                        )}
                          {group.rows.map(({ deposit: d, reminder: rem }) => {
                            const client = clientMap[d.clientId];
                            const assoc = d.associationId
                              ? associationMap[d.associationId]
                              : null;
                            const meta = reminderMeta[d.id];
                            const needsPay = depositRequiresPayment(d.depositType);
                            const actionDone = !!rem?.actionDoneAt;
                            const paidDone = !!(rem?.paymentDoneAt || rem?.paidAt);
                            const monthBucket =
                              rem?.monthBucket ||
                              (rem?.targetDate || "").slice(0, 7);
                            const monthMark = monthCode(monthBucket);
                            const openWork = !(
                              actionDone &&
                              (!needsPay || paidDone)
                            );
                            const urgency = depositUrgency(
                              rem?.targetDate,
                              openWork
                            );
                            const typeText =
                              d.depositType === "kollel_scholarship"
                                ? `${depositTypeShortLabel[d.depositType]} · ${scholarshipDeliveryLabel[d.scholarshipDelivery || "cash"]}`
                                : depositTypeShortLabel[d.depositType];
                            const rowKey = rem ? rem.id : d.id;
                            return (
                              <tr
                                key={rowKey}
                                draggable={d.active}
                                onDragStart={(e) => {
                                  if (!d.active) return;
                                  const origin = e.target as HTMLElement;
                                  if (
                                    origin.closest(
                                      "button, a, input, textarea, select"
                                    )
                                  ) {
                                    e.preventDefault();
                                    return;
                                  }
                                  dragPayload.current = {
                                    depositId: d.id,
                                    reminderId: rem?.id,
                                  };
                                  e.dataTransfer.setData("text/plain", rowKey);
                                  e.dataTransfer.effectAllowed = "move";
                                  window.setTimeout(() => setDragging(true), 0);
                                }}
                                onDragEnd={() => {
                                  dragPayload.current = null;
                                  setDragging(false);
                                  setDropTarget(null);
                                }}
                                title={d.active ? "גרור את השורה אל סטטוס אחר" : undefined}
                                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                                  d.active ? "cursor-grab active:cursor-grabbing" : ""
                                }`}
                              >
                                <td className="px-1 py-1.5 text-center text-slate-300">
                                  {d.active ? <GripVertical size={15} /> : null}
                                </td>
                                <td
                                  className="px-3 py-1.5 font-semibold text-navy-950 whitespace-nowrap"
                                  title={d.notes || undefined}
                                >
                                  {client?.name || "לקוח לא ידוע"}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {monthMark ? (
                                    <span
                                      className="inline-flex h-7 items-center rounded-full bg-navy-950 px-2.5 text-xs font-black text-white"
                                      title={
                                        [
                                          monthBucket
                                            ? formatMonthBucket(monthBucket)
                                            : "",
                                          meta && meta.sends > 0
                                            ? `נשלחו ${meta.sends} תזכורות`
                                            : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || undefined
                                      }
                                    >
                                      {monthMark}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                                  {typeText}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                                  {assoc?.name || "—"}
                                </td>
                                <td className="px-3 py-1.5">
                                  {depositShowsPayerField(d) ? (
                                    <PayerCell
                                      depositId={d.id}
                                      reminderId={rem?.id}
                                      value={rem?.payerName || ""}
                                      onSaved={(saved) =>
                                        setDocs((prev) => ({
                                          ...prev,
                                          [saved.id]: saved,
                                        }))
                                      }
                                      onError={(message) => setToast(message)}
                                    />
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-navy-950">
                                  {money(d.amount)}
                                </td>
                                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                                  {rem
                                    ? new Date(rem.targetDate).toLocaleDateString("he-IL")
                                    : `יום ${d.dayOfMonth}`}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-1">
                                    {urgency === "critical" && (
                                      <span className="inline-flex h-7 items-center rounded-full bg-red-600 px-2 text-[11px] font-black text-white">
                                        קריטי
                                      </span>
                                    )}
                                    {urgency === "urgent" && (
                                      <span className="inline-flex h-7 items-center rounded-full bg-amber-500 px-2 text-[11px] font-black text-white">
                                        דחוף
                                      </span>
                                    )}
                                    <StatusMark
                                      label="בוצע"
                                      tone="teal"
                                      on={actionDone}
                                      onClick={() =>
                                        void setDocFlag(
                                          d.id,
                                          rem?.id,
                                          "action",
                                          !actionDone
                                        )
                                      }
                                    />
                                    {needsPay && (
                                      <StatusMark
                                        label="שולם"
                                        tone="gold"
                                        on={paidDone}
                                        onClick={() =>
                                          void setDocFlag(
                                            d.id,
                                            rem?.id,
                                            "paid",
                                            !paidDone
                                          )
                                        }
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      className={`h-7 rounded-full px-2 text-[11px] font-bold ${
                                        d.active
                                          ? "bg-teal-50 text-teal-800"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                      onClick={() => toggleActive(d)}
                                    >
                                      {d.active ? "פעיל" : "כבוי"}
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                      onClick={() => sendNow(d, "advisor", rem?.id)}
                                      disabled={!d.active}
                                      title="שליחה ליועץ"
                                    >
                                      <Send size={13} /> יועץ
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                      onClick={() => sendNow(d, "client", rem?.id)}
                                      disabled={!d.active}
                                      title="שליחה ללקוח"
                                    >
                                      <Send size={13} /> לקוח
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                                      onClick={() => openEdit(d)}
                                      title="עריכה"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                                      onClick={() => remove(d.id)}
                                      title="מחיקה"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    ))}
                  </table>
                </div>
                )}
              </section>
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
                  <label className="label">איך המילגה משולמת</label>
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
                  שליחה אוטומטית היא ליועץ בלבד. שליחה ללקוח מתבצעת ידנית מהשורה של
                  החודש.
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
