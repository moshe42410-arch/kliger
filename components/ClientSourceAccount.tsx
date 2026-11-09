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
  const [accountNumber, setAccountNumber] = useState(client.sourceAccountNumber || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
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
          accountNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "השמירה נכשלה");
      onSaved(data);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-sm font-bold text-navy-950">פרטי חשבון להעברת המילגה</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="edit-account-holder">שם בעל החשבון</label>
          <input id="edit-account-holder" className="input" value={accountHolder} onChange={(e) => { setAccountHolder(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <label className="label" htmlFor="edit-source-bank">בנק</label>
          <input id="edit-source-bank" className="input" value={bank} onChange={(e) => { setBank(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <label className="label" htmlFor="edit-source-branch">סניף</label>
          <input id="edit-source-branch" className="input" value={branch} onChange={(e) => { setBranch(e.target.value); setSaved(false); }} />
        </div>
        <div>
          <label className="label" htmlFor="edit-source-account">מספר חשבון</label>
          <input id="edit-source-account" className="input" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); setSaved(false); }} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn-secondary text-sm" onClick={() => void save()} disabled={saving}>
          {saving ? "שומר..." : "שמירת פרטי חשבון"}
        </button>
        {saved && <span className="text-xs font-bold text-teal-700">נשמר</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
