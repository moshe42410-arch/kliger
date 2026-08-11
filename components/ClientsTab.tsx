"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Landmark,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import type { CaseType, Client, ReminderChannel } from "@/lib/db";
import {
  BANK_OPTIONS,
  CASE_TYPES,
  caseTypeLabel,
  reminderChannelLabel,
} from "@/lib/types";

interface ClientFormState {
  id?: string;
  name: string;
  emails: string[];
  phones: string[];
  reminderChannel: ReminderChannel;
  caseType: CaseType | "";
  bank: string;
  requiredAmount: string;
  propertyValue: string;
  propertyAddress: string;
}

const emptyForm: ClientFormState = {
  name: "",
  emails: [""],
  phones: [""],
  reminderChannel: "email",
  caseType: "",
  bank: "",
  requiredAmount: "",
  propertyValue: "",
  propertyAddress: "",
};

function formatILS(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₪${n}`;
  }
}

/** אחוז מימון = סכום מבוקש / שווי נכס */
function financingPercent(
  requiredAmount: number | null | undefined,
  propertyValue: number | null | undefined
): number | null {
  if (
    requiredAmount == null ||
    propertyValue == null ||
    !Number.isFinite(requiredAmount) ||
    !Number.isFinite(propertyValue) ||
    propertyValue <= 0
  ) {
    return null;
  }
  return (requiredAmount / propertyValue) * 100;
}

function formatPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded)
    ? `${rounded}%`
    : `${rounded.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%`;
}

export function ClientsTab({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  useEffect(() => {
    if (!importToast) return;
    const t = setTimeout(() => setImportToast(null), 5000);
    return () => clearTimeout(t);
  }, [importToast]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const hay = [
        c.name,
        c.bank || "",
        c.propertyAddress || "",
        c.caseType ? caseTypeLabel[c.caseType] : "",
        ...c.emails,
        ...c.phones,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, query]);

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
      caseType: c.caseType || "",
      bank: c.bank || "",
      requiredAmount: c.requiredAmount != null ? String(c.requiredAmount) : "",
      propertyValue: c.propertyValue != null ? String(c.propertyValue) : "",
      propertyAddress: c.propertyAddress || "",
    });
    setShowForm(true);
    setError(null);
  }

  async function save(options?: { createDeposit?: boolean; openCase?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        emails: form.emails.map((e) => e.trim()).filter(Boolean),
        phones: form.phones.map((p) => p.trim()).filter(Boolean),
        reminderChannel: form.reminderChannel,
        caseType: form.caseType || null,
        bank: form.bank || null,
        requiredAmount: form.requiredAmount ? Number(form.requiredAmount) : null,
        propertyValue: form.propertyValue ? Number(form.propertyValue) : null,
        propertyAddress: form.propertyAddress.trim() || null,
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
      } else if (options?.openCase || !form.id) {
        router.push(`/clients/${saved.id}`);
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

  async function downloadTemplate() {
    const res = await fetch("/api/clients/import-excel");
    if (!res.ok) {
      setImportToast("שגיאה בהורדת התבנית");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kliger-clients-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    setImportToast(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/clients/import-excel", {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "ייבוא נכשל");
      }
      const created: Client[] = Array.isArray(j.created) ? j.created : [];
      if (created.length) {
        setClients((prev) => [...created, ...prev]);
      }
      const parts = [`יובאו ${j.createdCount ?? created.length} לקוחות`];
      if (j.skippedCount) parts.push(`${j.skippedCount} דולגו (כבר קיימים)`);
      if (j.errorCount) parts.push(`${j.errorCount} שגיאות`);
      setImportToast(parts.join(" · "));
      router.refresh();
    } catch (e) {
      setImportToast(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {importToast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-bold text-white max-w-lg text-center"
          style={{
            background:
              "linear-gradient(135deg, #3fbfaf 0%, #369989 55%, #265f58 100%)",
            boxShadow: "0 20px 40px -10px rgba(54,153,137,0.5)",
          }}
        >
          {importToast}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="section-title mb-2">לקוחות</h1>
          <p className="section-subtitle">ניהול תיקי הלקוחות של המשרד</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => onImportFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void downloadTemplate()}
            title="הורדת תבנית אקסל"
          >
            <Download size={16} /> תבנית אקסל
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? (
              "מייבא…"
            ) : (
              <>
                <Upload size={16} /> ייבוא מאקסל
              </>
            )}
          </button>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={18} /> הוספת לקוח
          </button>
        </div>
      </div>

      {clients.length > 0 && (
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-500 pointer-events-none"
          />
          <input
            className="input pr-10"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לקוחות לפי שם, מייל, טלפון, בנק…"
            aria-label="חיפוש לקוחות"
          />
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card text-center py-16">
          <div className="inline-flex p-5 rounded-full bg-gold-500/15 mb-4">
            <Plus size={32} className="text-gold-600" />
          </div>
          <h3 className="text-xl font-heading font-bold text-navy-950 mb-2">
            אין לקוחות עדיין
          </h3>
          <p className="text-navy-700 mb-5">התחל בהוספת הלקוח הראשון שלך</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet size={18} /> ייבוא מאקסל
            </button>
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={18} /> הוספת לקוח ראשון
            </button>
          </div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-heading font-bold text-navy-950 mb-2">
            לא נמצאו לקוחות
          </h3>
          <p className="text-navy-700">נסה מילת חיפוש אחרת</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((c) => (
            <div
              key={c.id}
              className="card flex flex-col md:flex-row gap-4 md:items-center justify-between cursor-pointer hover:border-gold-500/40 transition-colors"
              onClick={() => router.push(`/clients/${c.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-xl font-heading font-bold text-navy-950">
                    {c.name}
                  </h3>
                  {c.caseType && (
                    <span className="chip chip-purple">
                      {caseTypeLabel[c.caseType]}
                    </span>
                  )}
                  {c.requiredAmount != null && (
                    <span className="text-sm font-semibold text-navy-900 tabular-nums">
                      {formatILS(c.requiredAmount)}
                    </span>
                  )}
                  {(() => {
                    const pct = financingPercent(
                      c.requiredAmount,
                      c.propertyValue
                    );
                    if (pct == null) return null;
                    return (
                      <span
                        className="chip chip-blue"
                        title={`סכום מבוקש ${formatILS(c.requiredAmount)} מתוך שווי נכס ${formatILS(c.propertyValue)}`}
                      >
                        מימון {formatPercent(pct)}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-700">
                  {c.bank && (
                    <div className="flex items-center gap-2">
                      <Landmark size={14} className="text-teal-600" />
                      {c.bank}
                    </div>
                  )}
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
                  <div className="flex items-center gap-2">
                    <Bell size={12} className="text-navy-500" />
                    {reminderChannelLabel[c.reminderChannel]}
                  </div>
                </div>
              </div>
              <div
                className="flex gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
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
          <div className="modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">מהות התיק</label>
                  <select
                    className="select"
                    value={form.caseType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        caseType: e.target.value as CaseType | "",
                      })
                    }
                  >
                    <option value="">— בחירה —</option>
                    {CASE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {caseTypeLabel[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">בנק</label>
                  <select
                    className="select"
                    value={form.bank}
                    onChange={(e) => setForm({ ...form, bank: e.target.value })}
                  >
                    <option value="">— בחירה —</option>
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">סכום נדרש</label>
                  <input
                    className="input"
                    type="number"
                    dir="ltr"
                    value={form.requiredAmount}
                    onChange={(e) =>
                      setForm({ ...form, requiredAmount: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">שווי נכס</label>
                  <input
                    className="input"
                    type="number"
                    dir="ltr"
                    value={form.propertyValue}
                    onChange={(e) =>
                      setForm({ ...form, propertyValue: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">כתובת הנכס</label>
                  <input
                    className="input"
                    value={form.propertyAddress}
                    onChange={(e) =>
                      setForm({ ...form, propertyAddress: e.target.value })
                    }
                    placeholder="רחוב, עיר"
                  />
                </div>
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
                    onClick={() => save({ openCase: true })}
                    disabled={saving}
                  >
                    <Save size={18} />
                    {saving ? "שומר..." : "שמור ופתח תיק"}
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
