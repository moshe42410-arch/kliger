"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ContactRound,
  Trash2,
  Edit3,
  X,
  Mail,
  Phone,
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
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="section-title mb-2">אנשי קשר</h1>
          <p className="section-subtitle">
            ניהול נמענים לשליחת מסמכים ומיילים מהמערכת
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto" onClick={openCreate}>
          <Plus size={18} /> הוספת איש קשר
        </button>
      </div>

      {contacts.length > 0 && (
        <div className="mb-6">
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
        <div className="grid gap-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <h3 className="text-lg font-heading font-bold text-navy-950">
                  {c.name}
                </h3>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-navy-700">
                  {c.email && (
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Mail size={14} /> {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="inline-flex items-center gap-1" dir="ltr">
                      <Phone size={14} /> {c.phone}
                    </span>
                  )}
                </div>
                {c.notes && (
                  <p className="text-xs text-navy-500 mt-2 whitespace-pre-wrap">
                    {c.notes}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => openEdit(c)}
                >
                  <Edit3 size={14} /> עריכה
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => void remove(c.id)}
                >
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
