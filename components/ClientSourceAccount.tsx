"use client";

import { useState } from "react";
import type { Client } from "@/lib/db";

export function ClientSourceAccount({
  client,
  onSaved,
}: {
  client: Client;
  onSaved: (client: Client) => void;
}) {
  const payerName = client.sourcePayerName || "";
  const [accountHolder, setAccountHolder] = useState(client.sourceAccountHolder || "");
  const [bank, setBank] = useState(client.sourceBank || "");
  const [branch, setBranch] = useState(client.sourceBranch || "");
  const [amount, setAmount] = useState(client.sourceAmount || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/source-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerName,
          accountHolder,
          bank,
          branch,
          amount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
      onSaved(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-sm font-bold text-navy-950">פרטי חשבון להעברת המילגה</p>
      <p className="mb-3 text-xs text-slate-500">
        נשמרים פעם אחת ומצורפים למייל העמותה. שם המעביר נשאל בכל העברה בנפרד.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className="input" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="שם בעל החשבון" aria-label="שם בעל החשבון" />
        <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="בנק" aria-label="בנק" />
        <input className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="סניף" aria-label="סניף" />
        <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="סכום" aria-label="סכום" />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" className="btn-secondary text-sm" onClick={() => void save()} disabled={saving}>
          {saving ? "שומר..." : "שמירת פרטי חשבון"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
