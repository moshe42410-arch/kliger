"use client";

import { useState } from "react";
import { Mail, Phone, User, MessageSquare, Send, CheckCircle2, AlertCircle } from "lucide-react";

interface FormState {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

export function ContactTab() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!form.name.trim()) {
      setStatus({ type: "error", text: "נא להזין שם מלא" });
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setStatus({ type: "error", text: "נא להזין כתובת מייל תקינה" });
      return;
    }
    if (!form.message.trim()) {
      setStatus({ type: "error", text: "נא להזין תוכן הודעה" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "שליחה נכשלה");
      }
      setStatus({
        type: "success",
        text: "תודה! ההודעה נשלחה בהצלחה ונחזור אליך בהקדם.",
      });
      setForm(emptyForm);
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8 text-center">
        <h1 className="section-title mb-3">צור קשר</h1>
        <p className="section-subtitle">
          יש לך שאלה, הצעה או בקשה? מלא את הטופס ונחזור אליך בהקדם.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label flex items-center gap-2">
              <User size={16} /> שם מלא <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="ישראל ישראלי"
              required
              disabled={sending}
            />
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Mail size={16} /> אימייל <span className="text-red-600">*</span>
            </label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="name@example.com"
              required
              disabled={sending}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Phone size={16} /> טלפון
            </label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="050-0000000"
              disabled={sending}
              dir="ltr"
            />
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <MessageSquare size={16} /> נושא
            </label>
            <input
              className="input"
              type="text"
              value={form.subject}
              onChange={(e) => update("subject", e.target.value)}
              placeholder="במה נוכל לעזור?"
              disabled={sending}
            />
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-2">
            <MessageSquare size={16} /> תוכן ההודעה{" "}
            <span className="text-red-600">*</span>
          </label>
          <textarea
            className="textarea min-h-[160px] resize-y"
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="כתוב כאן את פרטי הפנייה שלך..."
            required
            disabled={sending}
            rows={6}
          />
        </div>

        {status && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-start gap-2 ${
              status.type === "success"
                ? "bg-teal-50 border-teal-200 text-teal-900"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle2 size={20} className="text-teal-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <span>{status.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="text-xs text-navy-600">
            ההודעה תישלח ישירות למייל של הצוות.
          </div>
          <button
            type="submit"
            className="btn-primary min-w-[180px]"
            disabled={sending}
          >
            <Send size={18} />
            {sending ? "שולח..." : "שלח הודעה"}
          </button>
        </div>
      </form>
    </div>
  );
}
