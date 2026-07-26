"use client";

import { useEffect, useRef, useState } from "react";
import {
  Save,
  RotateCcw,
  Eye,
  X,
  User as UserIcon,
  Briefcase,
  ChevronDown,
  Copy,
} from "lucide-react";

interface Template {
  subject: string;
  body: string;
}
interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  audience: "client" | "advisor";
  hasUploadUrl: boolean;
}
interface TemplateVar {
  key: string;
  label: string;
  example: string;
}

const TEMPLATE_VARIABLES: TemplateVar[] = [
  { key: "clientName", label: "שם הלקוח", example: "יוסי כהן" },
  { key: "advisorName", label: "שם היועץ", example: "משה קליגר" },
  { key: "companyName", label: "שם החברה", example: "קליגר ייעוץ" },
  { key: "amount", label: "סכום", example: "₪12,500" },
  { key: "targetDate", label: "תאריך יעד", example: "15/09/2026" },
  { key: "depositType", label: "סוג ההפקדה", example: "תלוש שכר" },
  { key: "uploadUrl", label: "קישור אסמכתא", example: "https://kliger.co.il/upload/xxxxx" },
  { key: "associationName", label: "שם עמותה", example: "עמותה לדוגמה" },
  { key: "accountBlock", label: "פרטי חשבון", example: "מס' חשבון: 12345\n..." },
  { key: "advisorPhone", label: "טלפון היועץ", example: "052-7144445" },
  { key: "daysLate", label: "ימי איחור", example: "3" },
];

export function EmailTemplatesEditor() {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [defaults, setDefaults] = useState<Record<string, Template>>({});
  const [meta, setMeta] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewOf, setPreviewOf] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/email-templates");
      const j = await res.json();
      if (res.ok) {
        setTemplates(j.templates);
        setDefaults(j.defaults);
        setMeta(j.meta);
        if (j.meta.length && !expanded) setExpanded(j.meta[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  function updateField(
    id: string,
    field: "subject" | "body",
    value: string
  ) {
    setTemplates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveOne(id: string) {
    setSaving(id);
    try {
      // שולחים תמיד את כל התבניות — השרת מסנן ריקות/זהות ל-default
      const res = await fetch("/api/users/me/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const j = await res.json();
      if (res.ok) {
        setTemplates(j.templates);
        notify("נשמר בהצלחה");
      } else {
        notify(j.error || "שמירה נכשלה");
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setSaving(null);
    }
  }

  function resetToDefault(id: string) {
    if (!confirm("לשחזר את התבנית לניסוח המקורי? כל השינויים יימחקו.")) return;
    setTemplates((prev) => ({ ...prev, [id]: { ...defaults[id] } }));
  }

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) {
    return (
      <div className="card text-center text-navy-600 py-12">טוען תבניות...</div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-6 border-b border-navy-950/8">
        <h2 className="text-2xl font-heading text-navy-950 mb-2">
          עריכת תבניות מיילים
        </h2>
        <p className="text-navy-700 text-sm leading-relaxed">
          כאן אפשר להתאים את הניסוח של כל סוג תזכורת שנשלחת מהמערכת. השתמש
          במשתנים כמו <code className="bg-cream-100 px-1.5 py-0.5 rounded font-mono text-xs" dir="ltr">{"{clientName}"}</code> —
          המערכת תחליף אותם אוטומטית בזמן השליחה. תבנית שהשארת ריקה תשתמש בברירת
          המחדל.
        </p>
      </div>

      <div className="divide-y divide-navy-950/8">
        {meta.map((m) => {
          const tpl = templates[m.id] || defaults[m.id];
          const def = defaults[m.id];
          const isCustomized =
            tpl.subject !== def.subject || tpl.body !== def.body;
          const isOpen = expanded === m.id;
          return (
            <div key={m.id}>
              <button
                onClick={() => setExpanded(isOpen ? null : m.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-cream-100/50 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    m.audience === "client"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gold-100 text-gold-700"
                  }`}
                >
                  {m.audience === "client" ? (
                    <UserIcon size={18} strokeWidth={1.75} />
                  ) : (
                    <Briefcase size={18} strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-navy-950">
                      {m.label}
                    </span>
                    {isCustomized && (
                      <span className="text-[10px] bg-gold-500 text-navy-950 px-2 py-0.5 rounded-full font-bold tracking-wide">
                        מותאם
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-navy-600 mt-0.5">
                    {m.description}
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-navy-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 bg-cream-100/30 space-y-4">
                  <div>
                    <label className="label">שורת נושא</label>
                    <input
                      className="input font-mono text-sm"
                      value={tpl.subject}
                      onChange={(e) =>
                        updateField(m.id, "subject", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="label">גוף המייל</label>
                    <textarea
                      className="input min-h-[180px] font-mono text-sm leading-relaxed resize-y"
                      value={tpl.body}
                      onChange={(e) =>
                        updateField(m.id, "body", e.target.value)
                      }
                      dir="rtl"
                    />
                  </div>

                  <VariablePicker
                    audience={m.audience}
                    hasUploadUrl={m.hasUploadUrl}
                    onInsert={(key) =>
                      updateField(m.id, "body", `${tpl.body}{${key}}`)
                    }
                  />

                  <div className="flex justify-end gap-2 flex-wrap pt-2">
                    <button
                      className="btn-ghost"
                      onClick={() => setPreviewOf(m.id)}
                      type="button"
                    >
                      <Eye size={16} /> תצוגה מקדימה
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => resetToDefault(m.id)}
                      type="button"
                    >
                      <RotateCcw size={16} /> שחזר לברירת מחדל
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => saveOne(m.id)}
                      disabled={saving === m.id}
                      type="button"
                    >
                      <Save size={16} />
                      {saving === m.id ? "שומר..." : "שמור שינויים"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {previewOf && (
        <PreviewModal
          template={templates[previewOf] || defaults[previewOf]}
          onClose={() => setPreviewOf(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-6 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold bg-teal-50 border border-teal-300 text-teal-900 z-[100]">
          {toast}
        </div>
      )}
    </div>
  );
}

function VariablePicker({
  audience,
  hasUploadUrl,
  onInsert,
}: {
  audience: "advisor" | "client";
  hasUploadUrl: boolean;
  onInsert: (key: string) => void;
}) {
  const vars = TEMPLATE_VARIABLES.filter((v) => {
    if (v.key === "uploadUrl" && !hasUploadUrl) return false;
    if (v.key === "daysLate" && audience !== "advisor") return false;
    return true;
  });

  return (
    <div className="p-3 rounded-xl bg-white border border-navy-950/10">
      <div className="text-[11px] font-semibold text-navy-700 mb-2 tracking-wide">
        משתנים זמינים (לחץ להעתקה — הדבק בגוף המייל)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              navigator.clipboard.writeText(`{${v.key}}`);
              onInsert(v.key);
            }}
            type="button"
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cream-100 border border-navy-950/8 hover:bg-gold-100/70 hover:border-gold-400/60 transition-all"
            title={`דוגמה: ${v.example}`}
          >
            <code className="font-mono text-[11px] text-navy-950" dir="ltr">
              {`{${v.key}}`}
            </code>
            <span className="text-[10px] text-navy-600">{v.label}</span>
            <Copy
              size={10}
              className="opacity-0 group-hover:opacity-60 text-navy-500"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function PreviewModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const previewVars: Record<string, string> = {};
  TEMPLATE_VARIABLES.forEach((v) => {
    previewVars[v.key] = v.example;
  });
  // accountBlock מיוחד — מציגים אותו רק אם קיים
  previewVars.accountBlock = "\n\nמס' חשבון עמותה: 12-345-6789\nבנק לאומי, סניף 800";

  const renderedSubject = renderPreview(template.subject, previewVars);
  const renderedBody = renderPreview(template.body, previewVars);

  return (
    <div
      className="fixed inset-0 z-[200] bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-navy-950/10 bg-cream-100/70">
          <h3 className="text-lg font-heading text-navy-950">תצוגה מקדימה</h3>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="mb-3 pb-3 border-b border-navy-950/10">
            <div className="text-[11px] text-navy-500 font-semibold tracking-wide mb-1">
              נושא:
            </div>
            <div className="text-navy-950 font-semibold">{renderedSubject}</div>
          </div>
          <div>
            <div className="text-[11px] text-navy-500 font-semibold tracking-wide mb-2">
              תוכן ההודעה:
            </div>
            <div className="whitespace-pre-wrap text-navy-800 leading-relaxed text-[15px] bg-cream-100/50 rounded-xl p-4 border border-navy-950/8">
              {renderedBody}
            </div>
          </div>
          <div className="mt-4 text-[11px] text-navy-500 leading-relaxed">
            * דוגמאות בלבד. הערכים האמיתיים יוזרקו לכל תזכורת בזמן שליחה.
          </div>
        </div>
      </div>
    </div>
  );
}

function renderPreview(str: string, vars: Record<string, string>): string {
  let out = str.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
