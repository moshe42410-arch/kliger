"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Folder, FolderOpen, Loader2, Search, X } from "lucide-react";

export type PickedDriveFolder = {
  id: string;
  name: string;
  url: string;
};

type FolderRow = {
  id: string;
  name: string;
  webViewLink: string | null;
};

type Crumb = { id: string; name: string };

export function DriveFolderPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (folder: PickedDriveFolder) => void | Promise<void>;
}) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([
    { id: "root", name: "הדרייב שלי" },
  ]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);

  const current = crumbs[crumbs.length - 1];

  const load = useCallback(async (parentId: string) => {
    setLoading(true);
    setError(null);
    setSearching(false);
    try {
      const res = await fetch(
        `/api/drive/folders?parent=${encodeURIComponent(parentId)}`,
        { cache: "no-store" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "טעינת תיקיות נכשלה");
      setFolders(j.folders || []);
    } catch (e) {
      setFolders([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCrumbs([{ id: "root", name: "הדרייב שלי" }]);
    setQuery("");
    setSearching(false);
    void load("root");
  }, [open, load]);

  async function runSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearching(false);
      await load(current.id);
      return;
    }
    setLoading(true);
    setError(null);
    setSearching(true);
    try {
      const res = await fetch(
        `/api/drive/folders?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "חיפוש נכשל");
      setFolders(j.folders || []);
    } catch (e) {
      setFolders([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function enterFolder(f: FolderRow) {
    setQuery("");
    setSearching(false);
    setCrumbs((c) => [...c, { id: f.id, name: f.name }]);
    void load(f.id);
  }

  function goToCrumb(index: number) {
    setQuery("");
    setSearching(false);
    const next = crumbs.slice(0, index + 1);
    setCrumbs(next);
    void load(next[index].id);
  }

  async function confirmCurrent() {
    if (current.id === "root") {
      setError("בחרו תיקייה ספציפית (לא את שורש הדרייב)");
      return;
    }
    setPicking(true);
    setError(null);
    try {
      await onPick({
        id: current.id,
        name: current.name,
        url: `https://drive.google.com/drive/folders/${current.id}`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  }

  async function confirmFolder(f: FolderRow) {
    setPicking(true);
    setError(null);
    try {
      await onPick({
        id: f.id,
        name: f.name,
        url:
          f.webViewLink ||
          `https://drive.google.com/drive/folders/${f.id}`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPicking(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col border border-navy-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-folder-picker-title"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-navy-100">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="text-navy-700 shrink-0" size={22} />
            <h2
              id="drive-folder-picker-title"
              className="font-heading font-bold text-navy-950 truncate"
            >
              בחירת תיקיית Drive
            </h2>
          </div>
          <button
            type="button"
            className="btn-ghost !p-2"
            onClick={onClose}
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400"
              />
              <input
                className="input !pr-9"
                placeholder="חיפוש שם תיקייה…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch(query);
                }}
              />
            </div>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => void runSearch(query)}
            >
              חפש
            </button>
          </div>

          {!searching && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-navy-600">
              {crumbs.map((c, i) => (
                <span key={`${c.id}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <span className="text-navy-300">/</span>}
                  <button
                    type="button"
                    className={`hover:underline ${
                      i === crumbs.length - 1
                        ? "font-semibold text-navy-900"
                        : ""
                    }`}
                    onClick={() => goToCrumb(i)}
                  >
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          {searching && (
            <p className="text-xs text-navy-500">תוצאות חיפוש</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-navy-600 text-sm">
              <Loader2 className="animate-spin" size={18} />
              טוען תיקיות…
            </div>
          ) : error ? (
            <div className="m-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : folders.length === 0 ? (
            <p className="text-center text-sm text-navy-500 py-16">
              אין תיקיות כאן
            </p>
          ) : (
            <ul className="divide-y divide-navy-50">
              {folders.map((f) => (
                <li key={f.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-3 px-3 py-2.5 text-right hover:bg-navy-50 rounded-xl min-w-0"
                    onClick={() => {
                      if (searching) {
                        void confirmFolder(f);
                      } else {
                        enterFolder(f);
                      }
                    }}
                  >
                    <Folder className="text-amber-600 shrink-0" size={18} />
                    <span className="truncate font-medium text-navy-900">
                      {f.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs shrink-0 !py-1.5"
                    disabled={picking}
                    onClick={() => void confirmFolder(f)}
                  >
                    בחר
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-navy-100">
          <button
            type="button"
            className="btn-ghost"
            disabled={crumbs.length <= 1 || searching || loading}
            onClick={() => goToCrumb(crumbs.length - 2)}
          >
            <ChevronLeft size={16} className="inline ml-1" />
            חזרה
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              ביטול
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={
                picking || loading || searching || current.id === "root"
              }
              onClick={() => void confirmCurrent()}
            >
              {picking ? "שומר…" : `בחר «${current.name}»`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
