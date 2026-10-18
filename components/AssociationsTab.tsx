"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Building2,
  Trash2,
  Edit3,
  X,
  Save,
  ArrowRight,
  Send,
} from "lucide-react";
import type { Association } from "@/lib/db";
import {
  associationQueueHint,
  type AssociationHandlingQueue,
} from "@/lib/association-queue";

interface FormState {
  id?: string;
  name: string;
  email: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  notes: string;
  handlingQueue: AssociationHandlingQueue;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  bankNumber: "",
  branchNumber: "",
  accountNumber: "",
  notes: "",
  handlingQueue: "paid",
};

export function AssociationsTab({
  initialAssociations,
  usage,
}: {
  initialAssociations: Association[];
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [associations, setAssociations] =
    useState<Association[]>(initialAssociations);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(a: Association) {
    setForm({
      id: a.id,
      name: a.name,
      email: a.email || "",
      bankNumber: a.bankNumber || "",
      branchNumber: a.branchNumber || "",
      accountNumber: a.accountNumber || "",
      notes: a.notes || "",
      handlingQueue: a.handlingQueue === "both" ? "both" : "paid",
    });
    setShowForm(true);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        bankNumber: form.bankNumber.trim(),
        branchNumber: form.branchNumber.trim(),
        accountNumber: form.accountNumber.trim(),
        notes: form.notes.trim(),
        handlingQueue: form.handlingQueue,
      };
      if (!payload.name) throw new Error("שם העמותה חובה");
      if (payload.email && !payload.email.includes("@"))
        throw new Error("מייל העמותה לא תקין");

      const url = form.id
        ? `/api/associations/${form.id}`
        : `/api/associations`;
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שמירה נכשלה");
      }
      const saved: Association = await res.json();
      setAssociations((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setShowForm(false);
      setForm(emptyForm);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/associations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAssociations((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    }
  }

  async function sendDigest(a: Association) {
    setNotice(null);
    setSendingId(a.id);
    try {
      const res = await fetch(`/api/associations/${a.id}/pending-digest`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "השליחה נכשלה");
      setNotice(`נשלחה התראה אל ${a.name} (${j.count} שורות) ל־${j.to}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="page-shell animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="section-title mb-1">עמותות</h1>
          <p className="section-subtitle">
            ניהול עמותות שאליהן מועברים הכספים - פרטי החשבון ישלחו ללקוח בתזכורת
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} /> הקמת עמותה
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm">
          {notice}
        </div>
      )}

      {associations.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex p-5 rounded-full bg-gold-500/15 mb-4">
            <Building2 size={32} className="text-gold-600" />
          </div>
          <h3 className="text-xl font-heading font-bold text-navy-950 mb-2">
            אין עמותות עדיין
          </h3>
          <p className="text-navy-700 mb-5">
            הקם עמותה ראשונה כדי שניתן יהיה לצרף אותה להפקדות
          </p>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={18} /> הקמת עמותה ראשונה
          </button>
        </div>
      ) : (
        <section className="data-shell">
          <header className="data-shell-head">
            <h2 className="data-shell-title">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
              עמותות
            </h2>
            <span className="data-count">{associations.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>עמותה</th>
                  <th>תור טיפול</th>
                  <th>מייל</th>
                  <th>בנק</th>
                  <th>סניף</th>
                  <th>חשבון</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {associations.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-950">
                      {a.name}
                      <div className="text-xs font-normal text-slate-500">
                        {usage[a.id]
                          ? `משויכת ל-${usage[a.id]} הפקדות`
                          : "לא משויכת להפקדות"}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {associationQueueHint(a.handlingQueue)}
                    </td>
                    <td className="text-slate-600" dir="ltr">
                      {a.email || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600" dir="ltr">
                      {a.bankNumber || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600" dir="ltr">
                      {a.branchNumber || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600" dir="ltr">
                      {a.accountNumber || "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="row-btn"
                          onClick={() => void sendDigest(a)}
                          disabled={!a.email || sendingId === a.id}
                          title={
                            a.email
                              ? "שליחת מייל אחד עם כל ההפקדות שממתינות לטיפול העמותה"
                              : "צריך מייל של העמותה כדי לשלוח"
                          }
                        >
                          <Send size={13} />
                          {sendingId === a.id ? "שולח..." : "התראה"}
                        </button>
                        <a
                          className="row-btn"
                          href="/settings?tab=templates&template=association_pending_digest"
                        >
                          ניסוח
                        </a>
                        <button className="row-btn" onClick={() => openEdit(a)}>
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="row-btn danger"
                          onClick={() => remove(a.id)}
                          title="מחיקה"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                {form.id ? "עריכת עמותה" : "הקמת עמותה"}
              </h2>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="label">שם העמותה *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="לדוגמה: עמותת חסדי ישראל"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">מייל העמותה</label>
                <input
                  className="input"
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="office@amuta.org.il"
                />
                <p className="text-xs text-navy-600 mt-1">
                  אליו נשלחים מיילי העברה של תזכורות + אסמכתאות שהלקוח העלה
                </p>
              </div>

              <div>
                <label className="label">פרטי חשבון להעברות</label>
                <p className="text-xs text-navy-600 mb-2">
                  הפרטים האלה מצורפים למייל כשמילגה מסומנת «משולם בהעברה».
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">מספר בנק</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.bankNumber}
                    onChange={(e) =>
                      setForm({ ...form, bankNumber: e.target.value })
                    }
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="label">מספר סניף</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.branchNumber}
                    onChange={(e) =>
                      setForm({ ...form, branchNumber: e.target.value })
                    }
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="label">מספר חשבון</label>
                  <input
                    className="input"
                    dir="ltr"
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm({ ...form, accountNumber: e.target.value })
                    }
                    placeholder="456789"
                  />
                </div>
              </div>
              </div>

              <div>
                <label className="label">מה ממתין לטיפול העמותה</label>
                <div className="grid gap-2">
                  <label className="flex items-start gap-2 text-sm text-navy-800">
                    <input
                      type="radio"
                      name="handlingQueue"
                      className="mt-1"
                      checked={form.handlingQueue === "paid"}
                      onChange={() =>
                        setForm({ ...form, handlingQueue: "paid" })
                      }
                    />
                    <span>
                      <span className="font-semibold">
                        רק מה שסומן שולם וממתין לבוצע
                      </span>
                      <span className="block text-xs text-navy-500">
                        יישלחו חודשים שסומנו שולם ועדיין לא סומנו בוצע.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-navy-800">
                    <input
                      type="radio"
                      name="handlingQueue"
                      className="mt-1"
                      checked={form.handlingQueue === "both"}
                      onChange={() =>
                        setForm({ ...form, handlingQueue: "both" })
                      }
                    />
                    <span>
                      <span className="font-semibold">
                        ממתינים גם לשולם וגם לבוצע
                      </span>
                      <span className="block text-xs text-navy-500">
                        יישלחו חודשים שעדיין לא סומנו שולם ולא בוצע. מה שכבר
                        סומן בוצע לא נשלח.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">הערות (אופציונלי)</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

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
