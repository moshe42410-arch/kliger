"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ContactRound,
  Trash2,
  Edit3,
  X,
} from "lucide-react";
import type { Contact } from "@/lib/db";
import { EmptyState } from "@/components/EmptyState";

interface FormState {
  id?: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

export function ContactsTab({
  initialContacts,
}: {
  initialContacts: Contact[];
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.notes || "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(c: Contact) {
    setForm({
      id: c.id,
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      notes: c.notes || "",
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
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      };
      if (!payload.name) throw new Error("שם איש הקשר חובה");
      if (payload.email && !payload.email.includes("@"))
        throw new Error("מייל לא תקין");

      const url = form.id ? `/api/contacts/${form.id}` : `/api/contacts`;
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
      const saved: Contact = await res.json();
      setContacts((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, "he"));
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
    if (!confirm("למחוק את איש הקשר?")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="page-shell animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="section-title mb-1">אנשי קשר</h1>
          <p className="section-subtitle">
            ניהול נמענים לשליחת מסמכים ומיילים מהמערכת
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={openCreate}>
          <Plus size={18} /> הוספת איש קשר
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם, מייל, טלפון…"
            aria-label="חיפוש אנשי קשר"
          />
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState
          icon={ContactRound}
          tone="gold"
          title="אין אנשי קשר עדיין"
          description="הוסיפו נמענים קבועים — בנקים, עורכי דין, שמאים ועוד — לבחירה מהירה בשליחת מסמכים."
          action={{
            label: "הוספת איש קשר",
            onClick: openCreate,
          }}
        />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-navy-700">לא נמצאו תוצאות</p>
        </div>
      ) : (
        <section className="data-shell">
          <header className="data-shell-head">
            <h2 className="data-shell-title">
              <span className="h-2.5 w-2.5 rounded-full bg-gold-500" />
              אנשי קשר
            </h2>
            <span className="data-count">{filtered.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[720px]">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>מייל</th>
                  <th>טלפון</th>
                  <th>הערות</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-semibold text-navy-950">
                      {c.name}
                    </td>
                    <td className="text-slate-600" dir="ltr">
                      {c.email || "—"}
                    </td>
                    <td className="whitespace-nowrap text-slate-600" dir="ltr">
                      {c.phone || "—"}
                    </td>
                    <td className="max-w-[16rem] truncate text-slate-500">
                      {c.notes || "—"}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="row-btn"
                          onClick={() => openEdit(c)}
                        >
                          <Edit3 size={14} /> עריכה
                        </button>
                        <button
                          type="button"
                          className="row-btn danger"
                          onClick={() => void remove(c.id)}
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-heading font-bold text-navy-950">
                {form.id ? "עריכת איש קשר" : "הוספת איש קשר"}
              </h2>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">שם *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">מייל</label>
                <input
                  className="input"
                  dir="ltr"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">טלפון</label>
                <input
                  className="input"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">הערות</label>
                <textarea
                  className="textarea min-h-[80px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowForm(false)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? "שומר…" : "שמור"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
