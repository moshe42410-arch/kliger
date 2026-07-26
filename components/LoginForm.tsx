"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";

export function LoginForm({
  notice,
  next,
}: {
  notice: string | null;
  next: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "התחברות נכשלה");
        return;
      }
      if (j.mustChangePassword) {
        router.replace("/change-password");
        return;
      }
      router.replace(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const noticeInfo = notice ? getNoticeInfo(notice) : null;

  return (
    <form onSubmit={submit} className="card space-y-5 animate-fade-in-up">
      {noticeInfo && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${
            noticeInfo.tone === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : noticeInfo.tone === "success"
                ? "bg-teal-50 border-teal-200 text-teal-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{noticeInfo.text}</span>
        </div>
      )}

      {/* Sign in with Google */}
      <a
        href="/api/auth/google/connect?mode=login"
        className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white border border-navy-950/10 text-navy-950 font-semibold hover:bg-cream-100 hover:border-navy-950/20 transition-all shadow-sm"
      >
        <GoogleIcon />
        <span>התחברות עם Google</span>
      </a>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-navy-950/10" />
        <div className="text-[10px] tracking-[0.3em] font-semibold text-navy-500 uppercase">
          או עם סיסמה
        </div>
        <div className="flex-1 h-px bg-navy-950/10" />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <Mail size={14} /> מייל
        </label>
        <input
          className="input"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <Lock size={14} /> סיסמה
        </label>
        <input
          className="input"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full justify-center"
        disabled={loading || !email || !password}
      >
        <LogIn size={18} />
        {loading ? "מתחבר..." : "התחברות"}
      </button>

      <p className="text-center text-xs text-navy-600 pt-2 leading-relaxed">
        נכנסת בפעם הראשונה? השתמש בסיסמה שקיבלת במייל, ותתבקש להחליפה.
        <br/>
        <span className="text-navy-500">
          התחברות עם Google תחבר גם את המייל שלך אוטומטית לשליחת תזכורות.
        </span>
      </p>
    </form>
  );
}

interface NoticeInfo {
  text: string;
  tone: "info" | "success" | "error";
}

function getNoticeInfo(code: string): NoticeInfo {
  switch (code) {
    case "logged_out":
      return { text: "התנתקת בהצלחה", tone: "success" };
    case "session_expired":
      return { text: "הסשן פג — אנא התחבר שוב", tone: "info" };
    case "password_changed":
      return {
        text: "הסיסמה הוחלפה — התחבר עם הסיסמה החדשה",
        tone: "success",
      };
    case "google_no_user":
      return {
        text: "המייל של חשבון Google שלך לא נמצא במערכת. פנה למנהל שיפתח לך חשבון קודם.",
        tone: "error",
      };
    case "google_inactive":
      return {
        text: "המשתמש שלך הושבת. פנה למנהל המערכת.",
        tone: "error",
      };
    case "google_error":
      return {
        text: "החיבור עם Google נכשל. נסה שוב, ואם זה חוזר — התחבר עם מייל וסיסמה.",
        tone: "error",
      };
    case "state_mismatch":
      return {
        text: "החיבור פג תוקף. לחץ שוב על 'התחברות עם Google'.",
        tone: "info",
      };
    case "oauth_not_configured":
      return {
        text:
          "חיבור Google עדיין לא הוגדר במערכת. אפשר להתחבר עם מייל וסיסמה בינתיים.",
        tone: "info",
      };
    default:
      return { text: code, tone: "info" };
  }
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
