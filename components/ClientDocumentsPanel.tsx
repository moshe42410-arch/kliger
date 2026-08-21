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
  clientEmails,
  hasDriveFolder,
}: {
  clientId: string;
  clientName: string;
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [toExtra, setToExtra] = useState("");
  const [pickedContacts, setPickedContacts] = useState<Record<string, boolean>>(
    {}
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");

  function renderTpl(str: string, vars: Record<string, string>): string {
    return str
      .replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function openSend() {
    if (selectedIds.length === 0) {
      setError("בחרו לפחות קובץ אחד לשליחה");
      return;
    }
    const picked = docs.filter((d) => selected[d.id]);
    const filenames = picked.map((d) => d.originalName);
    const fileList = filenames.map((n) => `מצורף ${n}`).join("\n");
    const greetingName = clientName || "לקוח יקר";

    let subjectTpl = "מסמכים עבור {clientName}";
    let bodyTpl = `לכבוד {recipientName},\n\nמצורף:\n{fileList}\n\nבברכה,\n{companyName}`;
    let companyName = "KLIGER";
    let advisorName = "";

    try {
      const res = await fetch("/api/users/me/email-templates", {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        const tpl = j.templates?.documents_send;
        if (tpl?.subject) subjectTpl = tpl.subject;
        if (tpl?.body) bodyTpl = tpl.body;
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

    const vars = {
      recipientName: greetingName,
      clientName,
      fileList,
      fileNames: filenames.join(", "),
      fileCount: String(filenames.length),
      companyName,
      advisorName,
    };
    setRecipientName(greetingName);
    setSubject(renderTpl(subjectTpl, vars));
    setMessage(renderTpl(bodyTpl, vars));
    setToExtra("");
    setPickedContacts({});
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

  async function sendSelected() {
    setSending(true);
    setError(null);
    try {
      const pickedContactList = contacts.filter(
        (c) => pickedContacts[c.id] && c.email
      );
      const fromContacts = pickedContactList.map((c) => c.email!);
      const extra = toExtra
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter((x) => x.includes("@"));
      const to = [
        ...clientEmails.filter((e) => e.includes("@")),
        ...fromContacts,
        ...extra,
      ];
      const unique = Array.from(new Set(to));
      const greet =
        recipientName.trim() ||
        pickedContactList[0]?.name ||
        clientName ||
        "לקוח יקר";

      const res = await fetch(`/api/clients/${clientId}/documents/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selectedIds,
          to: unique,
          subject,
          message,
          recipientName: greet,
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
              {selectedIds.length} קבצים יישלחו כקבצים מצורפים. את הניסוח הקבוע
              אפשר לשנות ב־
              <a href="/settings?tab=templates" className="text-teal-700 underline mx-1">
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

              {contacts.length > 0 && (
                <div>
                  <label className="label">אנשי קשר</label>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-navy-100 divide-y divide-navy-50">
                    {contacts.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-navy-50"
                      >
                        <input
                          type="checkbox"
                          checked={!!pickedContacts[c.id]}
                          onChange={() => {
                            setPickedContacts((prev) => {
                              const next = { ...prev, [c.id]: !prev[c.id] };
                              const first = contacts.find(
                                (x) => next[x.id] && x.email
                              );
                              if (first?.name) setRecipientName(first.name);
                              else if (clientName) setRecipientName(clientName);
                              return next;
                            });
                          }}
                        />
                        <span className="font-medium text-navy-950">
                          {c.name}
                        </span>
                        <span className="text-navy-500 truncate" dir="ltr">
                          {c.email}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                <label className="label">שם הנמען (לכבוד…)</label>
                <input
                  className="input"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="רות קליין"
                />
              </div>
              <div>
                <label className="label">נושא</label>
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="label">גוף המייל</label>
                <textarea
                  className="textarea min-h-[160px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
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
