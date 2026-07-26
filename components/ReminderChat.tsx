"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Mail,
  Inbox,
  User as UserIcon,
  Briefcase,
  CheckCheck,
  AlertTriangle,
  Upload as UploadIcon,
  Clock,
  MessageSquare,
} from "lucide-react";
import type { Client, Deposit, Message, Reminder } from "@/lib/db";
import { depositTypeLabel } from "@/lib/types";

type ComposeMode = "email" | "record";

export function ReminderChat({
  reminder,
  client,
  deposit,
  onClose,
  onChanged,
}: {
  reminder: Reminder;
  client: Client | null;
  deposit: Deposit | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeMode, setComposeMode] = useState<ComposeMode>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const depositLabel = deposit ? depositTypeLabel[deposit.depositType] : "";
    setSubject(`מענה בנוגע ל${depositLabel || "תזכורת"}`);
  }, [deposit]);

  async function loadMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reminders/${reminder.id}/messages`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessages(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder.id]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const payload =
        composeMode === "email"
          ? { direction: "out", subject: subject.trim() || undefined, body: text }
          : { direction: "in", body: text };
      const res = await fetch(`/api/reminders/${reminder.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שליחה נכשלה");
      }
      setBody("");
      await loadMessages();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const depositLabel = deposit ? depositTypeLabel[deposit.depositType] : "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-3xl !p-0 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "min(86vh, 800px)" }}
      >
        <div className="px-6 py-4 border-b border-navy-950/8 bg-cream-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 shrink-0 border border-teal-200">
              <MessageSquare size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-heading font-bold text-navy-950 truncate">
                  צ&apos;אט עם {client?.name || "לקוח"}
                </h2>
                {deposit && (
                  <span className="chip chip-blue">{depositLabel}</span>
                )}
                {deposit && (
                  <span className="chip">
                    {new Intl.NumberFormat("he-IL", {
                      style: "currency",
                      currency: "ILS",
                      maximumFractionDigits: 0,
                    }).format(deposit.amount)}
                  </span>
                )}
              </div>
              {client && (
                <div className="text-xs text-navy-600 mt-1 truncate font-medium" dir="ltr">
                  {client.emails.join(", ")}
                </div>
              )}
            </div>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gradient-to-b from-cream-100/60 to-cream-200/40"
        >
          {loading ? (
            <div className="text-center text-navy-500 py-8">טוען הודעות...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-navy-500 py-8">
              <Inbox size={32} className="mx-auto mb-2 text-navy-400" />
              אין עדיין הודעות בצ&apos;אט זה.
              <br />
              שליחת מייל או הקלטת תגובת לקוח יופיעו כאן.
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} clientName={client?.name} />)
          )}
        </div>

        <div className="border-t border-navy-950/8 bg-white p-4">
          <div className="flex gap-2 mb-3">
            <button
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                composeMode === "email"
                  ? "bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[0_6px_18px_-6px_rgba(54,153,137,0.5)]"
                  : "bg-cream-100 text-navy-700 border border-navy-950/10 hover:border-teal-400/50"
              }`}
              onClick={() => setComposeMode("email")}
            >
              <Mail size={14} /> שלח מייל ללקוח
            </button>
            <button
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                composeMode === "record"
                  ? "bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 shadow-[0_6px_18px_-6px_rgba(212,175,55,0.5)]"
                  : "bg-cream-100 text-navy-700 border border-navy-950/10 hover:border-gold-400/50"
              }`}
              onClick={() => setComposeMode("record")}
            >
              <Inbox size={14} /> הקלט תגובה מהלקוח
            </button>
          </div>

          {composeMode === "email" && (
            <input
              className="input mb-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="נושא המייל"
            />
          )}

          <div className="flex gap-2">
            <textarea
              className="textarea flex-1 text-sm"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                composeMode === "email"
                  ? "כתוב מייל ללקוח... (Ctrl+Enter לשליחה)"
                  : "כתוב מה הלקוח אמר בטלפון / בוואטסאפ / בפגישה..."
              }
            />
            <button
              className="btn-primary self-stretch !px-4"
              onClick={send}
              disabled={sending || !body.trim()}
              title={composeMode === "email" ? "שלח מייל" : "הקלט תגובה"}
            >
              <Send size={16} />
            </button>
          </div>

          {composeMode === "record" && (
            <div className="mt-2 text-xs text-navy-600">
              תגובת לקוח שתוקלד כאן תסמן את התזכורת ל&quot;ממתין לטיפול יועץ&quot; - ללא שליחת מייל.
            </div>
          )}
          {composeMode === "email" && (
            <div className="mt-2 text-xs text-navy-600">
              המייל יישלח אל {client?.emails.join(", ") || "כתובות הלקוח"}.
            </div>
          )}

          {error && (
            <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  clientName,
}: {
  message: Message;
  clientName?: string;
}) {
  const isOut = message.direction === "out";
  const isIn = message.direction === "in";
  const isSystem = message.direction === "system";

  const time = new Date(message.createdAt).toLocaleString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="chip chip-blue text-xs">
          <Clock size={12} /> {message.body} · {time}
        </div>
      </div>
    );
  }

  const isUpload =
    isIn &&
    message.metadata &&
    (message.metadata as Record<string, unknown>).type === "upload";

  return (
    <div className={`flex ${isOut ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
          isOut
            ? "bg-gradient-to-br from-teal-500 to-teal-700 border border-teal-600 text-white"
            : "bg-white border border-gold-400/40 text-navy-950"
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5 text-xs">
          {isOut ? (
            <>
              <Briefcase size={12} className="text-teal-100" />
              <span className="font-bold text-teal-50">יועץ / מערכת</span>
            </>
          ) : (
            <>
              <UserIcon size={12} className="text-gold-600" />
              <span className="font-bold text-gold-700">
                {clientName || "הלקוח"}
              </span>
            </>
          )}
          {isOut && message.emailStatus === "sent" && (
            <span className="flex items-center gap-1 text-[10px] text-teal-100">
              <CheckCheck size={11} /> נשלח במייל
            </span>
          )}
          {isOut && message.emailStatus === "error" && (
            <span className="flex items-center gap-1 text-[10px] text-red-200">
              <AlertTriangle size={11} /> שגיאת שליחה
            </span>
          )}
          {isUpload && (
            <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
              <UploadIcon size={11} /> העלאת קובץ
            </span>
          )}
        </div>

        {message.subject && (
          <div className="text-xs font-semibold mb-1 opacity-85">
            {message.subject}
          </div>
        )}

        <div className="text-sm whitespace-pre-wrap leading-6">
          {message.body}
        </div>

        <div className="text-[10px] mt-1.5 opacity-70 text-left">{time}</div>

        {isOut && message.emailError && (
          <div className="mt-1 text-[10px] text-red-200 text-left">
            {message.emailError}
          </div>
        )}
      </div>
    </div>
  );
}
