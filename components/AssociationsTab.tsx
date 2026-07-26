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
  Banknote,
} from "lucide-react";
import type { Association } from "@/lib/db";

interface FormState {
  id?: string;
  name: string;
  email: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  bankNumber: "",
  branchNumber: "",
  accountNumber: "",
  notes: "",
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

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title mb-2">עמותות</h1>
          <p className="section-subtitle">
            ניהול עמותות שאליהן מועברים הכספים - פרטי החשבון ישלחו ללקוח בתזכורת
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} /> הקמת עמותה
        </button>
      </div>

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
        <div className="grid gap-4">
          {associations.map((a) => (
            <div
              key={a.id}
              className="card flex flex-col md:flex-row gap-4 md:items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h3 className="text-xl font-heading font-bold text-navy-950">
                    {a.name}
                  </h3>
                  {usage[a.id] ? (
                    <span className="chip chip-blue">
                      משויכת ל-{usage[a.id]} הפקדות
                    </span>
                  ) : (
                    <span className="chip">לא משויכת להפקדות</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-700">
                  {a.email && (
                    <div dir="ltr" className="text-navy-600 font-medium">
                      ✉ {a.email}
                    </div>
                  )}
                  {a.bankNumber && (
                    <div className="flex items-center gap-2">
                      <Banknote size={14} className="text-teal-600" />
                      בנק: <span dir="ltr">{a.bankNumber}</span>
                    </div>
                  )}
                  {a.branchNumber && (
                    <div>
                      סניף: <span dir="ltr">{a.branchNumber}</span>
                    </div>
                  )}
                  {a.accountNumber && (
                    <div>
                      חשבון: <span dir="ltr">{a.accountNumber}</span>
                    </div>
                  )}
                </div>
                {a.notes && (
                  <div className="mt-2 text-sm text-navy-500">{a.notes}</div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-ghost" onClick={() => openEdit(a)}>
                  <Edit3 size={16} /> עריכה
                </button>
                <button className="btn-danger" onClick={() => remove(a.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
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
