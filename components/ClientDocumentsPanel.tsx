"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Mail,
  Trash2,
  Upload,
  Download,
  ExternalLink,
  CheckSquare,
  Square,
  Loader2,
  RefreshCw,
  Cloud,
} from "lucide-react";
import type { Contact } from "@/lib/db";

export type ClientDocument = {
  id: string;
  originalName: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string;
  source?: "upload" | "drive";
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
};

function formatSize(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ClientDocumentsPanel({
  clientId,
  clientName,
  clientNationalId,
  clientEmails,
  hasDriveFolder,
}: {
  clientId: string;
  clientName: string;
  clientNationalId?: string | null;
  clientEmails: string[];
  hasDriveFolder: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [toExtra, setToExtra] = useState("");
  const [pickedContactId, setPickedContactId] = useState<string>("");
  const [contactQuery, setContactQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [includeLogo, setIncludeLogo] = useState(true);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);

  function renderTpl(str: string, vars: Record<string, string>): string {
    return str
      .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** מוודא שמספר הזהות מופיע ליד «מ.ז», ולא נשארת התווית לבד */
  function withNationalId(text: string, nationalId: string): string {
    const id = (nationalId || "").trim();
    if (!id) {
      return text
        .replace(/\s*[·\-–—]\s*מ\.ז\s*$/g, "")
        .replace(/\n?מ\.ז\s*:?\s*$/gm, "")
        .replace(/מ\.ז\s*(?=\n|$)/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    if (text.includes(id)) return text;
    if (/מ\.ז(?!\s*\d)/.test(text)) {
      return text.replace(/מ\.ז(?!\s*\d)/g, `מ.ז ${id}`);
    }
    return `${text} · מ.ז ${id}`.trim();
  }

  function findContactForRecipient(
    name: string,
    contactId?: string
  ): Contact | undefined {
    if (contactId) {
      const byId = contacts.find((c) => c.id === contactId && c.email);
      if (byId) return byId;
    }
    const q = name.trim().toLowerCase();
    if (!q) return undefined;
    const exact = contacts.find(
      (c) => c.email && c.name.trim().toLowerCase() === q
    );
    if (exact) return exact;
    return contacts.find(
      (c) =>
        c.email &&
        (c.name.toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q))
    );
  }

  /** לפני שמירת ברירת מחדל — מחזירים ערכים למשתנים כדי ש{nationalId} יישאר בתבנית */
  function toPlaceholders(
    text: string,
    vars: Record<string, string>
  ): string {
    let out = text;
    const entries = Object.entries(vars)
      .filter(([, v]) => v && v.trim().length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    for (const [key, val] of entries) {
      if (out.includes(val)) {
        out = out.split(val).join(`{${key}}`);
      }
    }
    return out;
  }

  async function openSend() {
    if (selectedIds.length === 0) {
      setError("בחרו לפחות קובץ אחד לשליחה");
      return;
    }
    const picked = docs.filter((d) => selected[d.id]);
    const filenames = picked.map((d) => d.originalName);
    const fileList = filenames.map((n) => `מצורף ${n}`).join("\n");
    const nationalId = (clientNationalId || "").trim();

    let subjectTpl = nationalId
      ? "מסמכים עבור {clientName} · מ.ז {nationalId}"
      : "מסמכים עבור {clientName}";
    let bodyTpl = nationalId
      ? `לכבוד {recipientName},\n\nמ.ז {nationalId}\n\nמצורף:\n{fileList}\n\nבברכה,\n{companyName}`
      : `לכבוד {recipientName},\n\nמצורף:\n{fileList}\n\nבברכה,\n{companyName}`;
    let companyName = "KLIGER";
    let advisorName = "";
    let recipientDefault = "";
    let logoDefault = true;

    try {
      const res = await fetch("/api/users/me/email-templates", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        const tpl = j.templates?.documents_send;
        if (tpl?.subject) subjectTpl = tpl.subject;
        if (tpl?.body) bodyTpl = tpl.body;
        if (j.documentsSendOptions) {
          if (typeof j.documentsSendOptions.includeLogo === "boolean") {
            logoDefault = j.documentsSendOptions.includeLogo;
          }
          if (typeof j.documentsSendOptions.recipientNameDefault === "string") {
            recipientDefault = j.documentsSendOptions.recipientNameDefault;
          }
        }
      }
      const me = await fetch("/api/users/me", { cache: "no-store" });
      if (me.ok) {
        const u = await me.json();
        companyName = u.companyName || u.name || companyName;
        advisorName = u.name || "";
      }
    } catch {
      /* defaults */
    }

    const greetingName =
      recipientDefault.trim() || clientName || "לקוח יקר";
    const matched = findContactForRecipient(greetingName);
    const vars = {
      recipientName: greetingName,
      clientName,
      nationalId,
      fileList,
      fileNames: filenames.join(", "),
      fileCount: String(filenames.length),
      companyName,
      advisorName,
    };
    setRecipientName(greetingName);
    setSubject(withNationalId(renderTpl(subjectTpl, vars), nationalId));
    setMessage(withNationalId(renderTpl(bodyTpl, vars), nationalId));
    setIncludeLogo(logoDefault);
    setToExtra("");
    setPickedContactId(matched?.id || "");
    setContactQuery("");
    setContactMenuOpen(false);
    setSendOpen(true);
    setError(null);
  }

  const loadDocs = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/documents`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "טעינת מסמכים נכשלה");
    }
    const data: ClientDocument[] = await res.json();
    setDocs(data);
  }, [clientId]);

  const syncDrive = useCallback(async (quiet = false) => {
    if (!hasDriveFolder) return;
    setSyncing(true);
    if (!quiet) setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/sync-drive`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "סנכרון דרייב נכשל");
      await loadDocs();
      if (!quiet) {
        setToast(
          `סנכרון הושלם: ${j.added || 0} חדשים · ${j.updated || 0} עודכנו · ${j.total || 0} בדרייב`
        );
      }
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }, [clientId, hasDriveFolder, loadDocs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (hasDriveFolder) {
          await syncDrive(true);
        } else {
          await loadDocs();
        }
        const cres = await fetch("/api/contacts", { cache: "no-store" });
        if (cres.ok) {
          const list: Contact[] = await cres.json();
          if (!cancelled) setContacts(list.filter((c) => c.email));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        try {
          await loadDocs();
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, hasDriveFolder]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedIds = docs.filter((d) => selected[d.id]).map((d) => d.id);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll() {
    if (selectedIds.length === docs.length) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const d of docs) next[d.id] = true;
    setSelected(next);
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "העלאה נכשלה");
      }
      setToast("הקבצים הועלו");
      await loadDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeDoc(id: string) {
    if (!confirm("להסיר את המסמך מהרשימה במערכת?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "מחיקה נכשלה");
      }
      setSelected((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setToast("הוסר מהרשימה");
      await loadDocs();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveAsDefaults() {
    setSavingDefaults(true);
    setError(null);
    try {
      const nationalId = (clientNationalId || "").trim();
      const picked = docs.filter((d) => selected[d.id]);
      const filenames = picked.map((d) => d.originalName);
      const fileList = filenames.map((n) => `מצורף ${n}`).join("\n");
      const vars = {
        recipientName: recipientName.trim(),
        clientName,
        nationalId,
        fileList,
        fileNames: filenames.join(", "),
        fileCount: String(filenames.length),
        companyName: "",
        advisorName: "",
      };
      // נסה לשחזר companyName מהגוף אם אפשר — לא קריטי
      const current = await fetch("/api/users/me/email-templates", {
        cache: "no-store",
      });
      const curJ = current.ok ? await current.json() : { templates: {} };
      const templates = { ...(curJ.templates || {}) };
      templates.documents_send = {
        subject: toPlaceholders(subject.trim(), vars),
        body: toPlaceholders(message.trim(), vars),
      };
      // אם אחרי ההמרה עדיין אין {nationalId} ויש מ.ז ללקוח — נוסיף למשתנה בנושא
      if (
        nationalId &&
        !templates.documents_send.subject.includes("{nationalId}")
      ) {
        if (!/מ\.ז/.test(templates.documents_send.subject)) {
          templates.documents_send.subject += " · מ.ז {nationalId}";
        } else {
          templates.documents_send.subject =
            templates.documents_send.subject.replace(
              /מ\.ז(?!\s*\{)/,
              "מ.ז {nationalId}"
            );
        }
      }
      if (
        nationalId &&
        !templates.documents_send.body.includes("{nationalId}")
      ) {
        if (!/מ\.ז/.test(templates.documents_send.body)) {
          templates.documents_send.body = templates.documents_send.body.replace(
            /^(לכבוד[^\n]*\n+)/,
            `$1מ.ז {nationalId}\n\n`
          );
        } else {
          templates.documents_send.body = templates.documents_send.body.replace(
            /מ\.ז(?!\s*\{)/,
            "מ.ז {nationalId}"
          );
        }
      }
      const res = await fetch("/api/users/me/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates,
          documentsSendOptions: {
            includeLogo,
            recipientNameDefault: recipientName.trim(),
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "שמירת ברירת מחדל נכשלה");
      setToast("ברירת המחדל נשמרה לשליחות הבאות");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDefaults(false);
    }
  }

  async function sendSelected() {
    setSending(true);
    setError(null);
    try {
      const matched = findContactForRecipient(
        recipientName,
        pickedContactId || undefined
      );
      if (matched && matched.id !== pickedContactId) {
        setPickedContactId(matched.id);
      }
      const fromContact = matched?.email ? [matched.email] : [];
      const extra = toExtra
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter((x) => x.includes("@"));
      const to = [
        ...clientEmails.filter((e) => e.includes("@")),
        ...fromContact,
        ...extra,
      ];
      const unique = Array.from(new Set(to));
      if (unique.length === 0) {
        throw new Error(
          "אין כתובת מייל לנמען — בחרו איש קשר מהרשימה (לא רק שם), או הזינו מייל ב«נמענים נוספים» / הוסיפו מייל ללקוח"
        );
      }
      const greet =
        recipientName.trim() ||
        matched?.name ||
        clientName ||
        "לקוח יקר";
      const nationalId = (clientNationalId || "").trim();

      const res = await fetch(`/api/clients/${clientId}/documents/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedIds,
          to: unique,
          subject: withNationalId(subject, nationalId),
          message: withNationalId(message, nationalId),
          recipientName: greet,
          includeLogo,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "שליחה נכשלה");
      setSendOpen(false);
      setToast(`נשלח ל־${(j.sentTo || unique).join(", ")}`);
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {toast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-bold text-white max-w-lg text-center"
          style={{
            background: "linear-gradient(135deg, #002147 0%, #0a2a4a 100%)",
            boxShadow: "0 20px 40px -10px rgba(0,33,71,0.45)",
          }}
          role="status"
        >
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm text-navy-600">
          {hasDriveFolder
            ? "קבצים מתיקיית הדרייב מסונכרנים אוטומטית. אפשר גם להעלות ידנית ולשלוח במייל."
            : "חברו תיקיית Drive למטה — ואז כל קובץ שיתווסף לתיקייה יופיע כאן. בינתיים אפשר להעלות ידנית."}
        </p>
        <div className="flex flex-wrap gap-2">
          {hasDriveFolder && (
            <button
              type="button"
              className="btn-ghost"
              disabled={syncing}
              onClick={() => void syncDrive(false)}
            >
              {syncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> מסנכרן…
                </>
              ) : (
                <>
                  <RefreshCw size={16} /> סנכרון מדרייב
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void onUpload(e.target.files)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> מעלה…
              </>
            ) : (
              <>
                <Upload size={16} /> העלאה ידנית
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={selectedIds.length === 0 || sending}
            onClick={openSend}
          >
            <Mail size={16} /> שלח במייל
            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-navy-500 py-6">טוען מסמכים…</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/40 px-4 py-10 text-center">
          <FileText className="mx-auto mb-2 text-navy-400" size={28} />
          <p className="text-navy-700 font-medium mb-1">אין מסמכים בתיק</p>
          <p className="text-sm text-navy-500">
            {hasDriveFolder
              ? "לחצו «סנכרון מדרייב» או העלו קבצים ידנית"
              : "חברו תיקיית Drive או העלו קבצים ידנית"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-ghost text-sm mb-1"
            onClick={toggleAll}
          >
            {selectedIds.length === docs.length ? (
              <>
                <CheckSquare size={14} /> בטל בחירת הכל
              </>
            ) : (
              <>
                <Square size={14} /> בחר הכל
              </>
            )}
          </button>

          {docs.map((d) => {
            const checked = !!selected[d.id];
            const fromDrive = d.source === "drive";
            return (
              <div
                key={d.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-3 py-3 ${
                  checked
                    ? "border-navy-950/30 bg-navy-50"
                    : "border-navy-100 bg-white"
                }`}
              >
                <button
                  type="button"
                  className="shrink-0 text-navy-800 self-start sm:self-center"
                  onClick={() => toggle(d.id)}
                  aria-pressed={checked}
                >
                  {checked ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-navy-950 truncate flex items-center gap-2">
                    {fromDrive && (
                      <Cloud size={14} className="text-navy-500 shrink-0" />
                    )}
                    <span className="truncate">{d.originalName}</span>
                  </div>
                  <div className="text-xs text-navy-500 mt-0.5">
                    {fromDrive ? "דרייב" : "הועלה"}
                    {formatSize(d.size) ? ` · ${formatSize(d.size)}` : ""}
                    {d.uploadedAt ? ` · ${d.uploadedAt.slice(0, 10)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {fromDrive && d.driveWebViewLink ? (
                    <a
                      className="btn-ghost text-sm"
                      href={d.driveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} /> בדרייב
                    </a>
                  ) : null}
                  <a
                    className="btn-ghost text-sm"
                    href={`/api/clients/${clientId}/documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} /> פתח
                  </a>
                  <a
                    className="btn-ghost text-sm"
                    href={`/api/clients/${clientId}/documents/${d.id}?download=1`}
                  >
                    <Download size={14} /> הורד
                  </a>
                  <button
                    type="button"
                    className="btn-danger text-sm !px-3"
                    onClick={() => void removeDoc(d.id)}
                    title={fromDrive ? "הסר מהרשימה (לא מוחק בדרייב)" : "מחק"}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sendOpen && (
        <div className="modal-backdrop" onClick={() => setSendOpen(false)}>
          <div
            className="modal max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-heading font-bold text-navy-950 mb-2 flex items-center gap-2">
              <Mail size={20} /> שליחת מסמכים במייל
            </h3>
            <p className="text-sm text-navy-600 mb-4">
              {selectedIds.length} קבצים יישלחו כקבצים מצורפים. אפשר לשמור את
              הנוסח כברירת מחדל למטה, או לערוך ב־
              <a
                href="/settings?tab=templates"
                className="text-teal-700 underline mx-1"
              >
                הגדרות → ניסוח מיילים
              </a>
              .
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="label">מיילי הלקוח</label>
                <p className="text-sm text-navy-800 mb-2">
                  {clientEmails.filter((e) => e.includes("@")).join(", ") ||
                    "אין מייל שמור ללקוח"}
                </p>
              </div>

              <div className="relative">
                <label className="label">שם הנמען (חיפוש מאנשי קשר)</label>
                <input
                  className="input"
                  placeholder="הקלידו שם לחיפוש, או בחרו מהרשימה…"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    setContactQuery(e.target.value);
                    setPickedContactId("");
                    setContactMenuOpen(true);
                  }}
                  onFocus={() => {
                    setContactQuery(recipientName);
                    setContactMenuOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setContactMenuOpen(false);
                      setPickedContactId((current) => {
                        if (current) return current;
                        return (
                          findContactForRecipient(recipientName)?.id || ""
                        );
                      });
                    }, 150);
                  }}
                  autoComplete="off"
                />
                {contacts.length > 0 && contactMenuOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-xl border border-navy-100 bg-white shadow-lg divide-y divide-navy-50">
                      {contacts
                        .filter((c) => {
                          const q = (contactQuery || recipientName)
                            .trim()
                            .toLowerCase();
                          if (!q) return true;
                          return (
                            c.name.toLowerCase().includes(q) ||
                            (c.email || "").toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 8)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`w-full text-right px-3 py-2 text-sm hover:bg-navy-50 flex items-center justify-between gap-2 ${
                              pickedContactId === c.id ? "bg-navy-50" : ""
                            }`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setPickedContactId(c.id);
                              setRecipientName(c.name);
                              setContactQuery("");
                              setContactMenuOpen(false);
                            }}
                          >
                            <span className="font-medium text-navy-950">
                              {c.name}
                            </span>
                            <span
                              className="text-navy-500 truncate text-xs"
                              dir="ltr"
                            >
                              {c.email}
                            </span>
                          </button>
                        ))}
                      {contacts.filter((c) => {
                        const q = (contactQuery || recipientName)
                          .trim()
                          .toLowerCase();
                        if (!q) return true;
                        return (
                          c.name.toLowerCase().includes(q) ||
                          (c.email || "").toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <div className="px-3 py-2 text-xs text-navy-500">
                          לא נמצאו אנשי קשר תואמים
                        </div>
                      )}
                    </div>
                  )}
                {(() => {
                  const linked =
                    contacts.find((c) => c.id === pickedContactId) ||
                    findContactForRecipient(recipientName);
                  if (!linked?.email) return null;
                  return (
                    <p className="text-xs text-teal-700 mt-1" dir="ltr">
                      יישלח גם ל־{linked.email}
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="label">נמענים נוספים</label>
                <input
                  className="input"
                  dir="ltr"
                  placeholder="email@example.com"
                  value={toExtra}
                  onChange={(e) => setToExtra(e.target.value)}
                />
              </div>
              <div>
                <label className="label">נושא</label>
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
                {!clientNationalId?.trim() && (
                  <p className="text-xs text-amber-700 mt-1">
                    אין מ.ז ללקוח — הוסיפו בהוספת/עריכת לקוח כדי שיופיע בנושא
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="label !mb-0">גוף המייל / ניסוח</label>
                  <button
                    type="button"
                    className="btn-ghost text-xs !py-1 !px-2"
                    disabled={
                      savingDefaults || !subject.trim() || !message.trim()
                    }
                    onClick={() => void saveAsDefaults()}
                  >
                    {savingDefaults ? "שומר…" : "שמור ניסוח כברירת מחדל"}
                  </button>
                </div>
                <textarea
                  className="textarea min-h-[160px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-[11px] text-navy-500 mt-1">
                  השמירה כוללת גם נושא, שם נמען, והעדפת לוגו
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-navy-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLogo}
                  onChange={(e) => setIncludeLogo(e.target.checked)}
                />
                שליחה עם לוגו ומעטפת מערכת (כבוי = מייל רגיל)
              </label>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSendOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={sending}
                onClick={() => void sendSelected()}
              >
                {sending ? "שולח…" : "שלח עכשיו"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
