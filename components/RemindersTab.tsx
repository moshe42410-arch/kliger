"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  X,
  Save,
  Calendar,
  User,
  AlertCircle,
  Download,
  Eye,
  Forward,
  BellRing,
  Building2,
  Pause,
  BadgeCheck,
  Users,
  Inbox,
  ArrowLeftRight,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import type {
  Association,
  Client,
  Deposit,
  Reminder,
  ReminderStatus,
} from "@/lib/db";
import {
  depositTypeLabel,
  reminderStatusLabel,
  reminderPhaseLabel,
  reminderRecipientLabel,
  responsibilityLabel,
} from "@/lib/types";
import { ReminderChat } from "./ReminderChat";

const STATUS_TABS: { key: ReminderStatus; chip: string }[] = [
  { key: "waiting_client", chip: "chip-amber" },
  { key: "waiting_advisor", chip: "chip-purple" },
  { key: "waiting_association", chip: "chip-blue" },
  { key: "snoozed", chip: "chip-gold" },
  { key: "resolved", chip: "chip-green" },
  { key: "carried_over", chip: "chip-red" },
];

const STATUS_ACCENT: Record<ReminderStatus, string> = {
  waiting_client: "bg-amber-400",
  waiting_advisor: "bg-purple-400",
  waiting_association: "bg-blue-400",
  snoozed: "bg-gold-400",
  resolved: "bg-emerald-400",
  carried_over: "bg-red-400",
};

const STATUS_MOVE_OPTIONS: {
  key: ReminderStatus;
  icon: typeof Clock;
  tone: string;
  description: string;
}[] = [
  {
    key: "waiting_client",
    icon: Clock,
    tone: "amber",
    description: "התזכורת תסומן כמחכה לתגובת הלקוח",
  },
  {
    key: "waiting_advisor",
    icon: BellRing,
    tone: "purple",
    description: "התזכורת תחזור לטיפול היועץ",
  },
  {
    key: "waiting_association",
    icon: Building2,
    tone: "blue",
    description: "התזכורת תסומן כמחכה לטיפול העמותה",
  },
  {
    key: "snoozed",
    icon: Pause,
    tone: "gold",
    description: "העברה להמתנה (יש להשתמש בכפתור 'תזכר אותי בעוד' לתזמון)",
  },
  {
    key: "resolved",
    icon: CheckCircle2,
    tone: "green",
    description: "סימון כטופל — התזכורת תיסגר",
  },
  {
    key: "carried_over",
    icon: AlertCircle,
    tone: "rose",
    description: "העברה למחודש קודם — תזכורת שגלשה",
  },
];

const MOVE_OPTION_STYLES: Record<
  string,
  { bg: string; border: string; text: string; iconBg: string }
> = {
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-900",
    iconBg: "bg-amber-100 text-amber-700",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200 hover:border-purple-400",
    text: "text-purple-900",
    iconBg: "bg-purple-100 text-purple-700",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200 hover:border-blue-400",
    text: "text-blue-900",
    iconBg: "bg-blue-100 text-blue-700",
  },
  gold: {
    bg: "bg-gold-100/70",
    border: "border-gold-400/50 hover:border-gold-500",
    text: "text-navy-950",
    iconBg: "bg-gold-100 text-gold-700",
  },
  green: {
    bg: "bg-teal-50",
    border: "border-teal-200 hover:border-teal-400",
    text: "text-teal-900",
    iconBg: "bg-teal-100 text-teal-700",
  },
  rose: {
    bg: "bg-red-50",
    border: "border-red-200 hover:border-red-400",
    text: "text-red-900",
    iconBg: "bg-red-100 text-red-700",
  },
};

export interface ReminderUploadInfo {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
}

export function RemindersTab({
  initialReminders,
  clients,
  deposits,
  associations = [],
  messageCounts = {},
  uploads = {},
}: {
  initialReminders: Reminder[];
  clients: Client[];
  deposits: Deposit[];
  associations?: Association[];
  messageCounts?: Record<string, { total: number; incoming: number }>;
  uploads?: Record<string, ReminderUploadInfo[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const s = searchParams?.get("status") as ReminderStatus | null;
    const valid: ReminderStatus[] = [
      "waiting_client",
      "waiting_advisor",
      "waiting_association",
      "snoozed",
      "resolved",
      "carried_over",
    ];
    return s && valid.includes(s) ? s : "waiting_client";
  })();
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [activeTab, setActiveTab] = useState<ReminderStatus>(initialTab);

  const [chatTarget, setChatTarget] = useState<Reminder | null>(null);

  const [snoozeTarget, setSnoozeTarget] = useState<Reminder | null>(null);
  const [snoozeDays, setSnoozeDays] = useState<string>("3");
  const [remindClientTarget, setRemindClientTarget] = useState<Reminder | null>(
    null
  );
  const [remindClientDays, setRemindClientDays] = useState<string>("3");
  const [moveTarget, setMoveTarget] = useState<Reminder | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);
  const depositMap = useMemo(() => {
    const m: Record<string, Deposit> = {};
    deposits.forEach((d) => (m[d.id] = d));
    return m;
  }, [deposits]);
  const associationMap = useMemo(() => {
    const m: Record<string, Association> = {};
    associations.forEach((a) => (m[a.id] = a));
    return m;
  }, [associations]);

  const counts = useMemo(() => {
    const c: Record<ReminderStatus, number> = {
      waiting_client: 0,
      waiting_advisor: 0,
      waiting_association: 0,
      snoozed: 0,
      resolved: 0,
      carried_over: 0,
    };
    reminders.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [reminders]);

  const filtered = reminders.filter((r) => r.status === activeTab);

  async function sendAgain(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}/send`, { method: "POST" });
    if (res.ok) {
      setToast(`נשלחה תזכורת ל-${clientMap[r.clientId]?.name || "לקוח"}`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "שליחה נכשלה"}`);
    }
  }

  async function doSnooze() {
    if (!snoozeTarget) return;
    const days = Number(snoozeDays);
    if (!isFinite(days) || days < 1) {
      setToast("מספר ימים לא תקין");
      return;
    }
    const res = await fetch(`/api/reminders/${snoozeTarget.id}/snooze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (res.ok) {
      setToast(`התזכורת הועברה ל"בהמתנה" - תחזור בעוד ${days} ימים`);
      setSnoozeTarget(null);
      router.refresh();
    }
  }

  async function doRemindClient() {
    if (!remindClientTarget) return;
    const days = Number(remindClientDays);
    if (!isFinite(days) || days < 1) {
      setToast("מספר ימים לא תקין");
      return;
    }
    const res = await fetch(
      `/api/reminders/${remindClientTarget.id}/remind-client`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      }
    );
    if (res.ok) {
      setToast(`הלקוח יקבל מייל תזכורת בעוד ${days} ימים`);
      setRemindClientTarget(null);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "לא ניתן היה לתזכר"}`);
    }
  }

  async function forwardToAssociation(r: Reminder) {
    const res = await fetch(
      `/api/reminders/${r.id}/forward-association`,
      { method: "POST" }
    );
    if (res.ok) {
      setReminders((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, status: "waiting_association" as const } : x
        )
      );
      setToast("התזכורת הועברה לטיפול העמותה");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "ההעברה נכשלה"}`);
    }
  }

  async function markResolved(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}/resolve`, { method: "POST" });
    if (res.ok) {
      setReminders((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: "resolved" as const } : x))
      );
      router.refresh();
    }
  }

  async function markPaid(r: Reminder) {
    const res = await fetch(`/api/reminders/${r.id}/mark-paid`, {
      method: "POST",
    });
    if (res.ok) {
      setReminders((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? {
                ...x,
                status: "resolved" as const,
                paidAt: new Date().toISOString(),
              }
            : x
        )
      );
      setToast("סומן כשולם — הנדנוד נעצר");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "סימון כשולם נכשל"}`);
    }
  }

  async function moveStatus(r: Reminder, status: ReminderStatus) {
    const res = await fetch(`/api/reminders/${r.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setReminders((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status } : x))
      );
      setMoveTarget(null);
      setToast(`התזכורת הועברה ל"${reminderStatusLabel[status]}"`);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setToast(`שגיאה: ${j.error || "העברת הסטטוס נכשלה"}`);
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-bold text-white animate-slide-down"
          style={{
            background:
              "linear-gradient(135deg, #3fbfaf 0%, #369989 55%, #265f58 100%)",
            boxShadow: "0 20px 40px -10px rgba(54,153,137,0.5)",
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
      <div className="mb-8">
        <h1 className="section-title mb-2">תזכורות</h1>
        <p className="section-subtitle">
          כל התזכורות של החודש הנוכחי + תזכורות שלא טופלו מחודשים קודמים
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 mb-6"
        role="tablist"
        aria-label="סינון תזכורות לפי סטטוס"
      >
        {STATUS_TABS.map((t) => {
          const isActive = activeTab === t.key;
          const c = counts[t.key] || 0;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(t.key)}
              className={`
                relative px-5 py-2.5 rounded-xl font-semibold border
                transition-all duration-200 ease-out
                ${
                  isActive
                    ? "bg-gradient-to-br from-teal-400 to-teal-600 text-white border-teal-500 shadow-[0_10px_30px_-8px_rgba(54,153,137,0.5)] -translate-y-0.5"
                    : "bg-white text-navy-700 border-navy-950/10 hover:border-teal-400/50 hover:-translate-y-0.5 hover:text-teal-700"
                }
              `}
            >
              <span>{reminderStatusLabel[t.key]}</span>
              <span
                className={`mr-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? "bg-white/25 text-white"
                    : c > 0
                      ? "bg-gold-500/20 text-gold-700"
                      : "bg-navy-950/8 text-navy-500"
                }`}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={activeTab === "resolved" ? CheckCircle2 : Inbox}
          tone={activeTab === "resolved" ? "green" : "gold"}
          title="אין תזכורות בקטגוריה זו"
          description={`הקטגוריה "${reminderStatusLabel[activeTab]}" ריקה כרגע.`}
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((r, idx) => {
            const client = clientMap[r.clientId];
            const deposit = depositMap[r.depositId];
            const depositLabel = deposit
              ? depositTypeLabel[deposit.depositType]
              : "";
            const statusAccent = STATUS_ACCENT[r.status];

            return (
              <div
                key={r.id}
                className="card card-interactive relative overflow-hidden animate-fade-in-up"
                style={{
                  animationDelay: `${Math.min(idx, 8) * 40}ms`,
                  animationFillMode: "backwards",
                }}
              >
                {/* Right accent strip (RTL - visual anchor on right side) */}
                <span
                  aria-hidden
                  className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${statusAccent}`}
                />
                <div className="flex flex-col lg:flex-row gap-4 lg:items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="chip">
                        <User size={12} /> {client?.name || "לקוח לא ידוע"}
                      </span>
                      {deposit && (
                        <>
                          <span className="chip chip-blue">{depositLabel}</span>
                          <span className="chip chip-amber">
                            {new Intl.NumberFormat("he-IL", {
                              style: "currency",
                              currency: "ILS",
                              maximumFractionDigits: 0,
                            }).format(deposit.amount)}
                          </span>
                          <span
                            className={`chip ${
                              deposit.responsibility === "advisor"
                                ? "chip-gold"
                                : "chip-purple"
                            }`}
                          >
                            {responsibilityLabel[deposit.responsibility]}
                          </span>
                        </>
                      )}
                      <span
                        className={`chip ${
                          r.phase === "verify_payment"
                            ? "chip-red"
                            : "chip-blue"
                        }`}
                      >
                        {r.phase === "verify_payment" ? (
                          <BadgeCheck size={12} />
                        ) : (
                          <BellRing size={12} />
                        )}
                        {reminderPhaseLabel[r.phase]}
                      </span>
                      {r.escalatedToClient && (
                        <span className="chip chip-red">
                          <Users size={12} /> הסלמה ללקוח
                        </span>
                      )}
                      {r.paidAt && (
                        <span className="chip chip-green">
                          <CheckCircle2 size={12} /> שולם
                        </span>
                      )}
                      {r.carriedOver && (
                        <span className="chip chip-red">
                          <AlertCircle size={12} /> מחודש קודם
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-700">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} className="text-teal-600" />
                        יעד:{" "}
                        {new Date(r.targetDate).toLocaleDateString("he-IL")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-teal-600" />
                        מתוזמן:{" "}
                        {new Date(r.scheduledFor).toLocaleDateString("he-IL")}
                      </span>
                      {r.lastSentAt && (
                        <span>
                          נשלחה:{" "}
                          {new Date(r.lastSentAt).toLocaleString("he-IL")}
                        </span>
                      )}
                      {r.sendsCount > 0 && <span>סה&quot;כ שליחות: {r.sendsCount}</span>}
                    </div>
                    {r.clientResponse && (
                      <div className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-sm">
                        <div className="font-bold mb-1">תגובת לקוח:</div>
                        <div>{r.clientResponse}</div>
                      </div>
                    )}
                    {uploads[r.id]?.length ? (
                      <div className="mt-3 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm">
                        <div className="font-bold mb-2">
                          אסמכתאות שהלקוח העלה ({uploads[r.id].length}):
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {uploads[r.id].map((u) => (
                            <div
                              key={u.id}
                              className="flex flex-wrap items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-teal-200"
                            >
                              <span className="flex-1 min-w-0 truncate">
                                📎 {u.originalName}
                                {u.size ? (
                                  <span className="text-teal-600">
                                    {" "}
                                    ({(u.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                ) : null}
                              </span>
                              <a
                                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                                href={`/api/uploads/${u.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Eye size={12} /> צפייה
                              </a>
                              <a
                                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                                href={`/api/uploads/${u.id}?download=1`}
                              >
                                <Download size={12} /> הורדה
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {r.status === "snoozed" && r.snoozeUntil && (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-gold-700 font-semibold">
                        <Pause size={12} /> בהמתנה עד{" "}
                        {new Date(r.snoozeUntil).toLocaleDateString("he-IL")}
                      </div>
                    )}
                    {r.clientRemindAt && r.status === "waiting_client" && (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-700 font-semibold">
                        <BellRing size={12} /> המייל הבא ללקוח:{" "}
                        {new Date(r.clientRemindAt).toLocaleDateString("he-IL")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:w-64 shrink-0">
                    {r.status !== "resolved" && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => sendAgain(r)}
                      >
                        <Send size={14} /> שליחת תזכורת מיידית
                      </button>
                    )}
                    <button
                      className="btn-secondary text-sm relative"
                      onClick={() => setChatTarget(r)}
                    >
                      <MessageSquare size={14} /> צ&apos;אט / שליחת הודעה
                      {messageCounts[r.id]?.total ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 text-[10px] font-bold mr-1">
                          {messageCounts[r.id].total}
                        </span>
                      ) : null}
                      {messageCounts[r.id]?.incoming ? (
                        <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-teal-500 ring-2 ring-white animate-pulse" />
                      ) : null}
                    </button>
                    {(r.status === "waiting_client" ||
                      r.status === "carried_over") && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => {
                          setRemindClientTarget(r);
                          setRemindClientDays("3");
                        }}
                      >
                        <BellRing size={14} /> תזכר את הלקוח בעוד...
                      </button>
                    )}
                    {r.status !== "resolved" && r.status !== "snoozed" && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => {
                          setSnoozeTarget(r);
                          setSnoozeDays("3");
                        }}
                      >
                        <Clock size={14} /> תזכר אותי בעוד...
                      </button>
                    )}
                    {r.status === "snoozed" && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => moveStatus(r, "waiting_advisor")}
                      >
                        <BellRing size={14} /> החזרה לטיפול עכשיו
                      </button>
                    )}
                    {r.status === "waiting_advisor" &&
                      deposit?.associationId &&
                      associationMap[deposit.associationId] && (
                        <button
                          className="btn-secondary text-sm"
                          onClick={() => forwardToAssociation(r)}
                          title={
                            associationMap[deposit.associationId!]?.email
                              ? `העבר לטיפול ${associationMap[deposit.associationId!]?.name}`
                              : "העמותה לא מוגדרת עם מייל"
                          }
                          disabled={
                            !associationMap[deposit.associationId!]?.email
                          }
                        >
                          <Forward size={14} /> העבר לעמותה
                        </button>
                      )}
                    {r.status === "waiting_association" && (
                      <div className="text-xs text-blue-800 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-200 font-semibold">
                        <Building2 size={12} />{" "}
                        הועבר לעמותה
                        {deposit?.associationId
                          ? ` ${associationMap[deposit.associationId]?.name ?? ""}`
                          : ""}
                      </div>
                    )}
                    {r.phase === "verify_payment" && !r.paidAt && (
                      <button
                        className="btn-primary text-sm"
                        onClick={() => markPaid(r)}
                        title="עוצר את נדנוד אימות התשלום"
                      >
                        <BadgeCheck size={14} /> סמן כשולם
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button
                        className="btn-primary text-sm"
                        onClick={() => markResolved(r)}
                      >
                        <CheckCircle2 size={14} /> טופל
                      </button>
                    )}
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => setMoveTarget(r)}
                      title="העבר את התזכורת לקטגוריה אחרת"
                    >
                      <ArrowLeftRight size={14} /> העברה לקטגוריה אחרת
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chatTarget && (
        <ReminderChat
          reminder={chatTarget}
          client={clientMap[chatTarget.clientId] ?? null}
          deposit={depositMap[chatTarget.depositId] ?? null}
          onClose={() => setChatTarget(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {snoozeTarget && (
        <div className="modal-backdrop" onClick={() => setSnoozeTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-heading font-bold text-navy-950">תזכר אותי בעוד...</h2>
              <button className="btn-ghost" onClick={() => setSnoozeTarget(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-navy-700">
                התזכורת תעבור לקטגוריית &quot;בהמתנה&quot;. תוחזר אליך אוטומטית לטיפול
                בעוד מספר הימים שבחרת (תקבל גם מייל).
              </p>
              <div>
                <label className="label">מספר ימים</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={snoozeDays}
                  onChange={(e) => setSnoozeDays(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14, 30].map((d) => (
                  <button
                    key={d}
                    className="btn-ghost text-sm"
                    onClick={() => setSnoozeDays(String(d))}
                  >
                    {d} ימים
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button className="btn-primary flex-1" onClick={doSnooze}>
                  <Save size={16} /> אישור
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setSnoozeTarget(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {remindClientTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setRemindClientTarget(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                תזכר את הלקוח בעוד...
              </h2>
              <button
                className="btn-ghost"
                onClick={() => setRemindClientTarget(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-navy-700">
                הלקוח יקבל מייל תזכורת אוטומטי לאחר מספר הימים שתבחר.
              </p>
              <div>
                <label className="label">מספר ימים</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={remindClientDays}
                  onChange={(e) => setRemindClientDays(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 5, 7, 14].map((d) => (
                  <button
                    key={d}
                    className="btn-ghost text-sm"
                    onClick={() => setRemindClientDays(String(d))}
                  >
                    {d} ימים
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary flex-1"
                  onClick={doRemindClient}
                >
                  <Save size={16} /> אישור
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setRemindClientTarget(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {moveTarget && (
        <div className="modal-backdrop" onClick={() => setMoveTarget(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560 }}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-heading font-bold text-navy-950 flex items-center gap-2">
                <ArrowLeftRight size={22} className="text-teal-600" />
                העברה לקטגוריה אחרת
              </h2>
              <button className="btn-ghost" onClick={() => setMoveTarget(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-navy-600 mb-5">
              בחר את הקטגוריה החדשה עבור התזכורת של{" "}
              <span className="font-semibold text-navy-950">
                {clientMap[moveTarget.clientId]?.name || "לקוח לא ידוע"}
              </span>
              . הקטגוריה הנוכחית מסומנת עם וי.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STATUS_MOVE_OPTIONS.map((opt) => {
                const isCurrent = moveTarget.status === opt.key;
                const styles = MOVE_OPTION_STYLES[opt.tone];
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() =>
                      !isCurrent && moveStatus(moveTarget, opt.key)
                    }
                    disabled={isCurrent}
                    className={`text-right p-4 rounded-xl border-2 transition-all ${styles.bg} ${
                      isCurrent
                        ? "opacity-70 cursor-default border-teal-500 ring-2 ring-teal-500/25"
                        : `${styles.border} hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-8px_rgba(0,33,71,0.18)] cursor-pointer`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${styles.iconBg}`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className={`font-heading font-bold ${styles.text}`}
                          >
                            {reminderStatusLabel[opt.key]}
                          </div>
                          {isCurrent && (
                            <CheckCircle2
                              size={16}
                              className="text-teal-600 shrink-0"
                            />
                          )}
                        </div>
                        <div
                          className={`text-xs mt-1 leading-relaxed ${
                            isCurrent ? "text-navy-500" : "text-navy-700"
                          }`}
                        >
                          {isCurrent ? "הקטגוריה הנוכחית" : opt.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 p-3 rounded-xl bg-cream-100 border border-gold-400/30 text-xs text-navy-700 flex items-start gap-2">
              <AlertCircle
                size={14}
                className="text-gold-600 shrink-0 mt-0.5"
              />
              <span>
                העברה ידנית לקטגוריה משנה רק את הסטטוס — אין השפעה על תזמון
                מיילים או שליחות. להעברה עם תזמון (למשל "בהמתנה עד..."),
                השתמש בכפתור &quot;תזכר אותי בעוד...&quot;.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
