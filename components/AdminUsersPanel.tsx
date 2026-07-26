"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Users,
  ShieldCheck,
  Mail,
  Phone,
  Building2,
  Edit3,
  Trash2,
  KeyRound,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Copy,
  Power,
} from "lucide-react";
import type { User } from "@/lib/db";

interface FormState {
  id?: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
};

interface ToastMsg {
  type: "success" | "error" | "info";
  message: string;
}

export function AdminUsersPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [tempPasswordDisplay, setTempPasswordDisplay] = useState<{
    email: string;
    password: string;
  } | null>(null);

  function notify(type: ToastMsg["type"], message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone || "",
      companyName: u.companyName || "",
    });
    setShowForm(true);
    setError(null);
  }

  async function saveUser() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        companyName: form.companyName.trim(),
      };
      if (!payload.name) throw new Error("שם חובה");
      if (!payload.email.includes("@")) throw new Error("מייל לא תקין");

      const url = form.id
        ? `/api/admin/users/${form.id}`
        : `/api/admin/users`;
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "שמירה נכשלה");

      if (form.id) {
        const updated: User = j;
        setUsers((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
        notify("success", "המשתמש עודכן");
      } else {
        const newUser: User = j.user;
        setUsers((prev) => [...prev, newUser]);
        if (j.emailSent) {
          notify(
            "success",
            `נשלח מייל הזמנה ל־${newUser.email}`
          );
        } else {
          notify(
            "info",
            `נוצר משתמש חדש. שליחת המייל נכשלה — צריך להעביר את הסיסמה ידנית`
          );
          if (j.tempPassword) {
            setTempPasswordDisplay({
              email: newUser.email,
              password: j.tempPassword,
            });
          }
        }
      }

      setShowForm(false);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    if (u.id === currentUserId) return;
    const nextActive = !u.active;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        companyName: u.companyName || "",
        active: nextActive,
      }),
    });
    if (res.ok) {
      const updated: User = await res.json();
      setUsers((prev) => prev.map((p) => (p.id === u.id ? updated : p)));
      notify(
        "success",
        nextActive ? `${u.name} הופעל מחדש` : `${u.name} הושבת`
      );
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      notify("error", j.error || "פעולה נכשלה");
    }
  }

  async function resetPassword(u: User) {
    if (
      !confirm(
        `לאפס את הסיסמה של ${u.name}? מייל עם סיסמה חדשה יישלח אליו/ה.`
      )
    )
      return;
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, {
      method: "POST",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify("error", j.error || "איפוס נכשל");
      return;
    }
    if (j.emailSent) {
      notify("success", `נשלח מייל עם סיסמה חדשה אל ${u.email}`);
    } else {
      notify("info", "המייל לא נשלח — יש להעביר את הסיסמה ידנית");
      if (j.tempPassword) {
        setTempPasswordDisplay({
          email: u.email,
          password: j.tempPassword,
        });
      }
    }
  }

  async function removeUser(u: User) {
    if (u.id === currentUserId) return;
    if (
      !confirm(
        `למחוק את המשתמש ${u.name}? פעולה זו לא הפיכה וכל הנתונים שלו יימחקו.`
      )
    )
      return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((p) => p.id !== u.id));
      notify("success", "המשתמש נמחק");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      notify("error", j.error || "מחיקה נכשלה");
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="section-title mb-2 flex items-center gap-3">
            <Users size={32} className="text-teal-600" /> ניהול יועצים
          </h1>
          <p className="section-subtitle">
            הוסף יועצים חדשים, עדכן פרטים, אפס סיסמאות והשבת חשבונות.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <UserPlus size={18} /> הוספת יועץ
        </button>
      </div>

      <div className="grid gap-4">
        {users.map((u) => (
          <div
            key={u.id}
            className={`card flex flex-col md:flex-row gap-4 md:items-center justify-between ${
              !u.active ? "opacity-60" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-xl font-heading font-bold text-navy-950">
                  {u.name}
                </h3>
                {u.role === "admin" && (
                  <span className="chip chip-gold">
                    <ShieldCheck size={12} /> אדמין
                  </span>
                )}
                {u.id === currentUserId && (
                  <span className="chip">אתה</span>
                )}
                {!u.active && (
                  <span className="chip chip-rose">מושבת</span>
                )}
                {u.mustChangePassword && (
                  <span className="chip chip-amber">
                    ממתין להחלפת סיסמה
                  </span>
                )}
                {u.gmailConnected ? (
                  <span className="chip chip-emerald">
                    Gmail מחובר
                  </span>
                ) : (
                  <span className="chip">Gmail לא מחובר</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-navy-700">
                <div dir="ltr" className="flex items-center gap-1.5">
                  <Mail size={14} className="text-teal-600" /> {u.email}
                </div>
                {u.phone && (
                  <div dir="ltr" className="flex items-center gap-1.5">
                    <Phone size={14} /> {u.phone}
                  </div>
                )}
                {u.companyName && (
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} /> {u.companyName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                className="btn-ghost"
                onClick={() => resetPassword(u)}
                title="איפוס סיסמה"
              >
                <KeyRound size={16} /> איפוס סיסמה
              </button>
              <button className="btn-ghost" onClick={() => openEdit(u)}>
                <Edit3 size={16} /> עריכה
              </button>
              {u.id !== currentUserId && (
                <button
                  className="btn-ghost"
                  onClick={() => toggleActive(u)}
                  title={u.active ? "השבת" : "הפעל"}
                >
                  <Power size={16} /> {u.active ? "השבת" : "הפעל"}
                </button>
              )}
              {u.id !== currentUserId && (
                <button
                  className="btn-danger"
                  onClick={() => removeUser(u)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                {form.id ? "עריכת יועץ" : "הוספת יועץ"}
              </h2>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="label">שם היועץ *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">מייל *</label>
                  <input
                    className="input"
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="advisor@example.com"
                  />
                </div>
                <div>
                  <label className="label">טלפון</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">שם חברה (אופציונלי)</label>
                <input
                  className="input"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="לדוגמה: קליגר ייעוץ פיננסי"
                />
              </div>

              {!form.id && (
                <div className="p-3 rounded-xl bg-cream-100 border border-gold-400/40 text-sm text-navy-700">
                  ✉ המערכת תיצור סיסמה זמנית ותשלח מייל הזמנה עם הפרטים.
                  היועץ יתבקש להחליף אותה בכניסה הראשונה.
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary flex-1"
                  onClick={saveUser}
                  disabled={saving}
                >
                  <Save size={18} />
                  {saving ? "שומר..." : form.id ? "עדכון" : "יצירה + שליחת מייל"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  <X size={16} /> ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tempPasswordDisplay && (
        <div
          className="modal-backdrop"
          onClick={() => setTempPasswordDisplay(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                סיסמה זמנית שנוצרה
              </h2>
              <button
                className="btn-ghost"
                onClick={() => setTempPasswordDisplay(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm mb-4 flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>
                המייל לא נשלח בהצלחה. עליך להעביר ידנית לסיסמה למשתמש —
                שמור אותה בטוח.
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-navy-600 mb-1 font-medium">משתמש</div>
                <div className="text-lg font-heading font-bold text-navy-950" dir="ltr">
                  {tempPasswordDisplay.email}
                </div>
              </div>
              <div>
                <div className="text-xs text-navy-600 mb-1 font-medium">
                  סיסמה זמנית
                </div>
                <div className="flex gap-2 items-center">
                  <code
                    className="flex-1 px-3 py-2 rounded-xl bg-cream-100 border border-gold-400/50 text-navy-950 font-mono tracking-wider font-bold"
                    dir="ltr"
                  >
                    {tempPasswordDisplay.password}
                  </code>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(tempPasswordDisplay.password)
                        .then(() => notify("success", "הועתק"));
                    }}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-6 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold z-[100] border max-w-md ${
            toast.type === "success"
              ? "bg-teal-50 border-teal-300 text-teal-900"
              : toast.type === "error"
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-cream-100 border-gold-400/60 text-navy-950"
          }`}
        >
          <div className="flex items-start gap-2">
            {toast.type === "success" && (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
