"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("סיסמה חדשה חייבת להיות באורך 8 תווים לפחות");
      return;
    }
    if (newPassword !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "שינוי סיסמה נכשל");
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 animate-fade-in-up">
      {forced && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>
            זו כניסתך הראשונה למערכת. בבקשה קבע סיסמה חדשה לפני שממשיכים.
          </span>
        </div>
      )}

      <div>
        <label className="label flex items-center gap-2">
          <KeyRound size={14} /> סיסמה נוכחית
        </label>
        <input
          className="input"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoFocus
          placeholder={forced ? "הסיסמה הזמנית מהמייל" : "••••••••"}
        />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <Lock size={14} /> סיסמה חדשה
        </label>
        <input
          className="input"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          placeholder="8 תווים ומעלה"
        />
      </div>

      <div>
        <label className="label flex items-center gap-2">
          <Lock size={14} /> אימות סיסמה חדשה
        </label>
        <input
          className="input"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          placeholder="חזרה על הסיסמה החדשה"
        />
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm flex items-start gap-2">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span>הסיסמה הוחלפה בהצלחה — מעביר אותך למערכת...</span>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full justify-center"
        disabled={loading || success}
      >
        <KeyRound size={18} />
        {loading ? "שומר..." : "עדכון סיסמה"}
      </button>
    </form>
  );
}
