"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  RotateCcw,
  Eye,
  X,
  User as UserIcon,
  Briefcase,
  Building2,
  FileText,
  ChevronDown,
  Copy,
  Mail,
} from "lucide-react";

interface Template {
  subject: string;
  body: string;
}
interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  category: "documents" | "reminders" | "ops";
  audience: "client" | "advisor" | "association" | "other";
  variableKeys: string[];
}
interface TemplateVar {
  key: string;
  label: string;
  example: string;
}

const CATEGORY_ORDER = ["documents", "reminders", "ops"] as const;

export function EmailTemplatesEditor() {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [defaults, setDefaults] = useState<Record<string, Template>>({});
  const [meta, setMeta] = useState<TemplateMeta[]>([]);
  const [variables, setVariables] = useState<TemplateVar[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(
    {
      documents: "מסמכי לקוח",
      reminders: "תזכורות הפקדות",
      ops: "התראות מערכת",
    }
  );
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
        if (Array.isArray(j.variables)) setVariables(j.variables);
        if (j.categoryLabels) setCategoryLabels(j.categoryLabels);
        if (j.meta?.length && !expanded) setExpanded(j.meta[0].id);
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

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateMeta[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const m of meta) {
      const list = map.get(m.category) || [];
      list.push(m);
      map.set(m.category, list);
    }
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      label: categoryLabels[cat] || cat,
      items: map.get(cat) || [],
    })).filter((g) => g.items.length > 0);
  }, [meta, categoryLabels]);

  if (loading) {
    return (
      <div className="card text-center text-navy-600 py-12">טוען תבניות...</div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-6 border-b border-navy-950/8">
        <h2 className="text-2xl font-heading text-navy-950 mb-2 flex items-center gap-2">
          <Mail size={22} className="text-teal-600" /> ניסוח כל המיילים
        </h2>
        <p className="text-navy-700 text-sm leading-relaxed">
          כאן מנוסחים כל המיילים שנשלחים מהמערכת — מסמכים, תזכורות והתראות.
          השתמשו במשתנים כמו{" "}
          <code
            className="bg-cream-100 px-1.5 py-0.5 rounded font-mono text-xs"
            dir="ltr"
          >
            {"{recipientName}"}
          </code>{" "}
          או{" "}
          <code
            className="bg-cream-100 px-1.5 py-0.5 rounded font-mono text-xs"
            dir="ltr"
          >
            {"{fileList}"}
          </code>
          ; המערכת תחליף אותם אוטומטית בזמן השליחה.
        </p>
      </div>

      {grouped.map((group) => (
        <div key={group.cat}>
          <div className="px-6 py-3 bg-navy-950 text-cream-50 text-sm font-semibold tracking-wide">
            {group.label}
          </div>
          <div className="divide-y divide-navy-950/8">
            {group.items.map((m) => {
              const tpl = templates[m.id] || defaults[m.id];
              const def = defaults[m.id];
              const isCustomized =
                tpl &&
                def &&
                (tpl.subject !== def.subject || tpl.body !== def.body);
              const isOpen = expanded === m.id;
              return (
                <div key={m.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 text-right hover:bg-cream-100/50 transition-colors"
                    type="button"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        m.category === "documents"
                          ? "bg-teal-100 text-teal-700"
                          : m.audience === "advisor"
                            ? "bg-gold-100 text-gold-700"
                            : m.audience === "association"
                              ? "bg-navy-100 text-navy-700"
                              : "bg-teal-100 text-teal-700"
                      }`}
                    >
                      {m.category === "documents" ? (
                        <FileText size={18} strokeWidth={1.75} />
                      ) : m.audience === "association" ? (
                        <Building2 size={18} strokeWidth={1.75} />
                      ) : m.audience === "advisor" ? (
                        <Briefcase size={18} strokeWidth={1.75} />
                      ) : (
                        <UserIcon size={18} strokeWidth={1.75} />
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

                  {isOpen && tpl && (
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
                        keys={m.variableKeys}
                        allVars={variables}
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
        </div>
      ))}

      {previewOf && (
        <PreviewModal
          template={templates[previewOf] || defaults[previewOf]}
          variables={variables}
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
  keys,
  allVars,
  onInsert,
}: {
  keys: string[];
  allVars: TemplateVar[];
  onInsert: (key: string) => void;
}) {
  const set = new Set(keys);
  const vars =
    allVars.length > 0
      ? allVars.filter((v) => set.has(v.key))
      : keys.map((key) => ({ key, label: key, example: "" }));

  return (
    <div className="p-3 rounded-xl bg-white border border-navy-950/10">
      <div className="text-[11px] font-semibold text-navy-700 mb-2 tracking-wide">
        משתנים זמינים (לחץ להוספה לגוף המייל)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vars.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              navigator.clipboard.writeText(`{${v.key}}`).catch(() => {});
              onInsert(v.key);
            }}
            type="button"
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cream-100 border border-navy-950/8 hover:bg-gold-100/70 hover:border-gold-400/60 transition-all"
            title={v.example ? `דוגמה: ${v.example}` : undefined}
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
  variables,
  onClose,
}: {
  template: Template;
  variables: TemplateVar[];
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
  variables.forEach((v) => {
    previewVars[v.key] = v.example;
  });
  previewVars.fileList = "מצורף דוח תוצאות עיון.pdf";
  previewVars.accountBlock = "\n\nמס' חשבון עמותה: 12-345-6789";

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
          <button onClick={onClose} className="btn-ghost !p-2" type="button">
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
            * דוגמאות בלבד. הערכים האמיתיים יוזרקו בזמן שליחה.
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
