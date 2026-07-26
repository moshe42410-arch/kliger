"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Mail,
  Phone,
  Trash2,
  Edit3,
  X,
  Save,
  ArrowRight,
  Bell,
} from "lucide-react";
import type { Client, ReminderChannel } from "@/lib/db";
import { reminderChannelLabel } from "@/lib/types";

interface ClientFormState {
  id?: string;
  name: string;
  emails: string[];
  phones: string[];
  reminderChannel: ReminderChannel;
}

const emptyForm: ClientFormState = {
  name: "",
  emails: [""],
  phones: [""],
  reminderChannel: "email",
};

export function ClientsTab({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(c: Client) {
    setForm({
      id: c.id,
      name: c.name,
      emails: c.emails.length ? c.emails : [""],
      phones: c.phones.length ? c.phones : [""],
      reminderChannel: c.reminderChannel,
    });
    setShowForm(true);
    setError(null);
  }

  async function save(options?: { createDeposit?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        emails: form.emails.map((e) => e.trim()).filter(Boolean),
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
        reminderChannel: form.reminderChannel,
      };
      if (!payload.name) throw new Error("שם הלקוח חובה");

      const url = form.id ? `/api/clients/${form.id}` : `/api/clients`;
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
      const saved: Client = await res.json();
      setClients((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setShowForm(false);
      setForm(emptyForm);
      if (options?.createDeposit) {
        router.push(`/deposits?newClientId=${saved.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="section-title mb-2">לקוחות</h1>
          <p className="section-subtitle">ניהול רשימת הלקוחות של העסק</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} /> הוספת לקוח
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex p-5 rounded-full bg-gold-500/15 mb-4">
            <Plus size={32} className="text-gold-600" />
          </div>
          <h3 className="text-xl font-heading font-bold text-navy-950 mb-2">
            אין לקוחות עדיין
          </h3>
          <p className="text-navy-700 mb-5">התחל בהוספת הלקוח הראשון שלך</p>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={18} /> הוספת לקוח ראשון
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map((c) => (
            <div key={c.id} className="card flex flex-col md:flex-row gap-4 md:items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xl font-heading font-bold text-navy-950">
                    {c.name}
                  </h3>
                  <span className="chip chip-purple">
                    <Bell size={12} /> {reminderChannelLabel[c.reminderChannel]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-700">
                  {c.emails.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail size={14} className="text-teal-600" />
                      {c.emails.map((e, i) => (
                        <span key={i} dir="ltr">
                          {e}
                          {i < c.emails.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.phones.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Phone size={14} className="text-teal-600" />
                      {c.phones.map((p, i) => (
                        <span key={i} dir="ltr">
                          {p}
                          {i < c.phones.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-ghost" onClick={() => openEdit(c)}>
                  <Edit3 size={16} /> עריכה
                </button>
                <button className="btn-danger" onClick={() => remove(c.id)}>
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
                {form.id ? "עריכת לקוח" : "הוספת לקוח חדש"}
              </h2>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="label">שם הלקוח *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="לדוגמה: ישראל ישראלי"
                  autoFocus
                />
              </div>

              <div>
                <label className="label">כתובות מייל</label>
                <div className="space-y-2">
                  {form.emails.map((email, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1"
                        type="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => {
                          const next = [...form.emails];
                          next[i] = e.target.value;
                          setForm({ ...form, emails: next });
                        }}
                        placeholder="name@example.com"
                      />
                      {form.emails.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() =>
                            setForm({
                              ...form,
                              emails: form.emails.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() =>
                      setForm({ ...form, emails: [...form.emails, ""] })
                    }
                  >
                    <Plus size={14} /> הוסף מייל נוסף
                  </button>
                </div>
              </div>

              <div>
                <label className="label">מספרי טלפון</label>
                <div className="space-y-2">
                  {form.phones.map((phone, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1"
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => {
                          const next = [...form.phones];
                          next[i] = e.target.value;
                          setForm({ ...form, phones: next });
                        }}
                        placeholder="050-0000000"
                      />
                      {form.phones.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() =>
                            setForm({
                              ...form,
                              phones: form.phones.filter((_, idx) => idx !== i),
                            })
                          }
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() =>
                      setForm({ ...form, phones: [...form.phones, ""] })
                    }
                  >
                    <Plus size={14} /> הוסף טלפון נוסף
                  </button>
                </div>
              </div>

              <div>
                <label className="label">תזכורות</label>
                <select
                  className="select"
                  value={form.reminderChannel}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reminderChannel: e.target.value as ReminderChannel,
                    })
                  }
                >
                  <option value="email">מייל</option>
                  <option value="phone">טלפון</option>
                  <option value="both">טלפון ומייל</option>
                </select>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex gap-3">
                  <button
                    className="btn-primary flex-1"
                    onClick={() => save()}
                    disabled={saving}
                  >
                    <Save size={18} />
                    {saving ? "שומר..." : "שמור"}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    <ArrowRight size={16} /> ביטול
                  </button>
                </div>
                <button
                  className="btn-secondary w-full justify-center"
                  onClick={() => save({ createDeposit: true })}
                  disabled={saving}
                >
                  <Plus size={18} />
                  {saving ? "שומר..." : "שמור וצור הפקדה ללקוח"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
