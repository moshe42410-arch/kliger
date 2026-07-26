"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  CheckCircle2,
  X,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function UploadForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  async function submit() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload/${token}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "העלאה נכשלה");
      }
      setDone(true);
      setTimeout(() => {
        window.location.reload();
      }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (done) {
    return (
      <div className="p-8 rounded-2xl bg-teal-50 border-2 border-teal-300 text-teal-900 text-center animate-scale-in relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-100/60 to-transparent" />
        <div className="relative">
          <div className="inline-flex p-4 rounded-full bg-teal-100 border border-teal-300 mb-3 animate-pulse-slow">
            <CheckCircle2 size={44} className="text-teal-600" />
          </div>
          <div className="font-heading font-bold text-fluid-lg text-navy-950">
            האסמכתא התקבלה בהצלחה!
          </div>
          <div className="text-sm mt-2 text-teal-800">
            תודה רבה, הצוות יטפל בפניה בהקדם.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          block cursor-pointer p-8 rounded-2xl border-2 border-dashed text-center
          transition-all duration-300 ease-out
          ${
            dragActive
              ? "border-gold-500 bg-gold-100/70 scale-[1.01] shadow-[0_16px_40px_-10px_rgba(212,175,55,0.45)]"
              : file
                ? "border-teal-400/70 bg-teal-50/70"
                : "border-gold-400/60 bg-cream-100/50 hover:border-gold-500 hover:bg-cream-100"
          }
        `}
      >
        {file ? (
          <div className="animate-fade-in-up">
            <div className="inline-flex p-3 rounded-2xl bg-teal-100 border border-teal-300 mb-3">
              <FileText size={28} className="text-teal-700" />
            </div>
            <div className="font-heading font-bold text-navy-950 text-fluid-base truncate max-w-full">
              {file.name}
            </div>
            <div className="text-xs text-teal-700 mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB · לחץ להחלפה
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearFile();
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors"
            >
              <X size={12} /> הסר קובץ
            </button>
          </div>
        ) : (
          <div>
            <div
              className={`inline-flex p-4 rounded-2xl border transition-all duration-300 ${
                dragActive
                  ? "bg-gold-200 border-gold-500 scale-110"
                  : "bg-gold-100/50 border-gold-400/50"
              }`}
            >
              <Upload
                size={36}
                className={`transition-transform duration-300 ${
                  dragActive ? "text-navy-950 scale-110" : "text-gold-700"
                }`}
              />
            </div>
            <div className="font-heading font-bold text-navy-950 mt-3 text-fluid-base">
              {dragActive ? "שחרר כאן..." : "גרור לכאן או לחץ לבחירת קובץ"}
            </div>
            <div className="text-xs text-navy-600 mt-2">
              מומלץ: PDF · אפשר גם תמונה / Word / Excel (עד 10MB)
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf,image/*,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      {error && (
        <div
          className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 animate-slide-down"
          role="alert"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <button
        className="btn-primary w-full text-fluid-base"
        onClick={submit}
        disabled={!file || uploading}
      >
        {uploading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            מעלה...
          </>
        ) : (
          <>
            <Upload size={18} />
            העלאת אסמכתא
          </>
        )}
      </button>
    </div>
  );
}
