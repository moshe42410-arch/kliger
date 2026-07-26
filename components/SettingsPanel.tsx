"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserCog,
  LayoutDashboard,
  Mail,
  Save,
  Upload,
  Trash2,
  ImageIcon,
  CheckCircle2,
  Circle,
  ShieldCheck,
  CheckCheck,
  AlertCircle,
  Link2,
  LogOut,
  MessageSquareQuote,
} from "lucide-react";
import type { User } from "@/lib/db";
import {
  DASHBOARD_CARDS,
  DEFAULT_DASHBOARD_CARDS,
  getActiveDashboardCards,
} from "@/lib/dashboard-cards";
import { EmailTemplatesEditor } from "./EmailTemplatesEditor";

interface ToastMsg {
  type: "success" | "error";
  message: string;
}

type Tab = "profile" | "email" | "templates" | "dashboard";

export function SettingsPanel({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab: Tab = ((): Tab => {
    const t = sp?.get("tab");
    if (t === "dashboard") return "dashboard";
    if (t === "email") return "email";
    if (t === "templates") return "templates";
    return "profile";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [user, setUser] = useState<User>(initialUser);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ----- Profile form state -----
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [companyName, setCompanyName] = useState(user.companyName || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // ----- Dashboard state -----
  const initialSelected = useMemo(
    () => new Set(getActiveDashboardCards(user.dashboardCards || null)),
    [user.dashboardCards]
  );
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [savingDash, setSavingDash] = useState(false);

  function notify(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          companyName: companyName.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "שמירה נכשלה");
      setUser(j);
      notify("success", "הפרטים נשמרו");
      router.refresh();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/users/me/logo`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "העלאה נכשלה");
      setUser((u) => ({ ...u, logoFilename: j.logoFilename }));
      notify("success", "הלוגו הועלה");
      router.refresh();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function removeLogo() {
    const res = await fetch(`/api/users/me/logo`, { method: "DELETE" });
    if (res.ok) {
      setUser((u) => ({ ...u, logoFilename: null }));
      notify("success", "הלוגו נמחק");
      router.refresh();
    }
  }

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveDashboard() {
    setSavingDash(true);
    try {
      const res = await fetch(`/api/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          phone: user.phone,
          companyName: user.companyName,
          dashboardCards: Array.from(selected),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "שמירה נכשלה");
      setUser(j);
      notify("success", "העדפות הדשבורד נשמרו");
      router.refresh();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingDash(false);
    }
  }

  function resetDashboard() {
    setSelected(new Set(DEFAULT_DASHBOARD_CARDS));
  }

  const grouped = useMemo(() => {
    return {
      pending: DASHBOARD_CARDS.filter((c) => c.category === "pending"),
      activity: DASHBOARD_CARDS.filter((c) => c.category === "activity"),
      info: DASHBOARD_CARDS.filter((c) => c.category === "info"),
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="section-title mb-2">הגדרות</h1>
        <p className="section-subtitle">
          פרופיל, חיבור מייל, ניסוח מיילים, ולוח הבקרה
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1.5 bg-white border border-navy-950/8 rounded-2xl w-fit flex-wrap shadow-sm">
        <TabButton
          active={tab === "profile"}
          onClick={() => setTab("profile")}
          icon={UserCog}
          label="פרופיל"
        />
        <TabButton
          active={tab === "email"}
          onClick={() => setTab("email")}
          icon={Mail}
          label="חיבור גוגל למייל"
        />
        <TabButton
          active={tab === "templates"}
          onClick={() => setTab("templates")}
          icon={MessageSquareQuote}
          label="ניסוח מיילים"
        />
        <TabButton
          active={tab === "dashboard"}
          onClick={() => setTab("dashboard")}
          icon={LayoutDashboard}
          label="לוח בקרה"
        />
      </div>

      {tab === "profile" && (
        <div className="card space-y-6">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-2xl bg-cream-100 border border-gold-400/40 overflow-hidden flex items-center justify-center shrink-0">
              {user.logoFilename ? (
                <img
                  src={`/api/users/${user.id}/logo/image?v=${encodeURIComponent(user.logoFilename)}`}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon size={32} className="text-navy-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-lg font-heading font-bold text-navy-950 mb-1">
                {user.name}
              </div>
              <div className="text-sm text-navy-600 mb-3 font-medium" dir="ltr">
                {user.email}
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className="btn-ghost cursor-pointer">
                  <Upload size={16} />{" "}
                  {uploadingLogo
                    ? "מעלה..."
                    : user.logoFilename
                      ? "החלף לוגו"
                      : "העלאת לוגו"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={onLogoSelected}
                  />
                </label>
                {user.logoFilename && (
                  <button className="btn-ghost" onClick={removeLogo}>
                    <Trash2 size={14} /> הסר לוגו
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">שם מלא *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">טלפון</label>
              <input
                className="input"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">שם חברה (מופיע במיילים ובלוגו)</label>
              <input
                className="input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="לדוגמה: קליגר ייעוץ פיננסי"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn-primary"
              onClick={saveProfile}
              disabled={savingProfile || !name.trim()}
            >
              <Save size={18} /> {savingProfile ? "שומר..." : "שמירה"}
            </button>
          </div>
        </div>
      )}

      {tab === "email" && (
        <EmailConnectionCard user={user} onRefresh={() => router.refresh()} />
      )}

      {tab === "templates" && <EmailTemplatesEditor />}

      {tab === "dashboard" && (
        <div className="card">
          <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-heading font-bold text-navy-950 mb-2">
                איזה כרטיסים להציג בלוח הבקרה?
              </h2>
              <p className="text-navy-700 text-sm">
                בחר אילו מדדים יופיעו במסך הראשי. ברירת המחדל היא להציג רק
                ממתינים לטיפול.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={resetDashboard}>
                איפוס לברירת המחדל
              </button>
              <button
                className="btn-primary"
                onClick={saveDashboard}
                disabled={savingDash}
              >
                <Save size={18} /> {savingDash ? "שומר..." : "שמירת העדפות"}
              </button>
            </div>
          </div>

          <CardGroup
            title="ממתינים לטיפול"
            subtitle="קטגוריות פעילות שמחייבות תגובה"
            cards={grouped.pending}
            selected={selected}
            onToggle={toggleCard}
          />
          <CardGroup
            title="פעילות החודש"
            subtitle="מדדים סטטיסטיים של החודש הנוכחי"
            cards={grouped.activity}
            selected={selected}
            onToggle={toggleCard}
          />
          <CardGroup
            title="מידע כללי"
            subtitle="סיכומים של לקוחות והפקדות"
            cards={grouped.info}
            selected={selected}
            onToggle={toggleCard}
          />
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-6 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold z-[100] border ${
            toast.type === "success"
              ? "bg-teal-50 border-teal-300 text-teal-900"
              : "bg-red-50 border-red-300 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof UserCog;
  label: string;
}) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
        active
          ? "bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-[0_6px_18px_-6px_rgba(54,153,137,0.5)]"
          : "text-navy-700 hover:bg-cream-100"
      }`}
      onClick={onClick}
    >
      <Icon size={18} /> {label}
    </button>
  );
}

function CardGroup({
  title,
  subtitle,
  cards,
  selected,
  onToggle,
}: {
  title: string;
  subtitle: string;
  cards: { id: string; label: string; description: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <div className="mb-7">
      <div className="mb-3">
        <div className="text-base font-heading font-bold text-navy-950">
          {title}
        </div>
        <div className="text-xs text-navy-600">{subtitle}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              className={`text-right p-4 rounded-xl transition-all border ${
                on
                  ? "bg-gold-100/70 border-gold-400/70 shadow-[0_6px_18px_-6px_rgba(212,175,55,0.35)]"
                  : "bg-white border-navy-950/10 hover:border-teal-400/50 hover:bg-cream-100"
              }`}
            >
              <div className="flex items-start gap-3">
                {on ? (
                  <CheckCircle2
                    size={20}
                    className="text-gold-600 shrink-0 mt-0.5"
                  />
                ) : (
                  <Circle
                    size={20}
                    className="text-navy-400 shrink-0 mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-navy-950">{c.label}</div>
                  <div className="text-xs text-navy-600 mt-1 leading-relaxed">
                    {c.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmailConnectionCard({
  user,
  onRefresh,
}: {
  user: User;
  onRefresh: () => void;
}) {
  const connected = user.gmailConnected;
  const sp = useSearchParams();
  const notice = sp?.get("notice");

  async function disconnect() {
    if (!confirm("לנתק את חיבור הגוגל? המערכת תפסיק לשלוח מיילים מהחשבון שלך."))
      return;
    const res = await fetch(`/api/auth/google/disconnect`, { method: "POST" });
    if (res.ok) onRefresh();
  }

  const noticeCopy: Record<string, { title: string; body: string }> = {
    oauth_not_configured: {
      title: "חיבור לגוגל עדיין לא הוגדר במערכת",
      body: "מנהל המערכת צריך להגדיר GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET בקובץ .env.local לפני שאפשר לחבר חשבונות. ראה קובץ .env.local.example למדריך.",
    },
    google_error: {
      title: "החיבור נכשל",
      body: "Google החזיר שגיאה. נסה שוב, ואם זה חוזר — בדוק שה־Redirect URI שהגדרת ב־Google Cloud זהה בדיוק לזה של המערכת.",
    },
    state_mismatch: {
      title: "החיבור פג תוקף",
      body: "החיבור לוקח יותר מדי זמן. לחץ שוב על 'חיבור לגוגל'.",
    },
    connected: {
      title: "מעולה! חשבון הגוגל שלך חובר בהצלחה",
      body: "כעת כל המיילים יישלחו מהחשבון האישי שלך.",
    },
  };
  const activeNotice = notice ? noticeCopy[notice] : null;

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold text-navy-950 mb-2 flex items-center gap-2">
          <Mail size={24} className="text-teal-600" /> חיבור גוגל למייל
        </h2>
        <p className="text-navy-700 text-sm">
          כדי שכל תזכורת/אסמכתא/דיגסט יישלחו מהמייל שלך (ולא מכתובת גנרית),
          יש לחבר את חשבון הגוגל שלך למערכת. אנחנו משתמשים ב־OAuth2 של Google —
          אתה תאשר במסך של Google ואנחנו נשתמש רק בהרשאת שליחת מיילים
          (<code dir="ltr">gmail.send</code>).
        </p>
      </div>

      {activeNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            notice === "connected"
              ? "bg-teal-50 border-teal-300"
              : "bg-amber-50 border-amber-300"
          }`}
        >
          <AlertCircle
            size={22}
            className={`shrink-0 mt-0.5 ${
              notice === "connected" ? "text-teal-600" : "text-amber-600"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div
              className={`font-semibold ${
                notice === "connected" ? "text-teal-900" : "text-amber-900"
              }`}
            >
              {activeNotice.title}
            </div>
            <div
              className={`text-xs mt-1 leading-relaxed ${
                notice === "connected" ? "text-teal-700" : "text-amber-700"
              }`}
            >
              {activeNotice.body}
            </div>
          </div>
        </div>
      )}

      {connected ? (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-300 flex items-center gap-3">
          <CheckCheck size={24} className="text-teal-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-teal-900">
              המערכת מחוברת ל־Gmail
            </div>
            <div className="text-xs text-teal-700" dir="ltr">
              שולחת מ־ {user.gmailEmail}
            </div>
          </div>
          <button className="btn-ghost" onClick={disconnect}>
            <LogOut size={16} /> נתק
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row items-start md:items-center gap-3">
          <AlertCircle size={24} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-amber-900 mb-1">
              עדיין לא חיברת את חשבון הגוגל שלך
            </div>
            <div className="text-xs text-amber-700">
              עד שלא תחבר — מיילים לא יישלחו (או יישלחו מ־SMTP הפולבק אם
              הוגדר).
            </div>
          </div>
          <a href="/api/auth/google/connect" className="btn-primary">
            <Link2 size={16} /> חיבור לגוגל
          </a>
        </div>
      )}

      <div className="p-4 rounded-xl bg-cream-100 border border-gold-400/30 text-xs text-navy-700 leading-relaxed">
        <div className="font-semibold text-navy-950 mb-2 flex items-center gap-2">
          <ShieldCheck size={14} className="text-gold-600" /> על ההרשאות והפרטיות
        </div>
        <ul className="list-disc pr-5 space-y-1">
          <li>אנחנו מבקשים רק הרשאת שליחת מיילים דרך החשבון שלך.</li>
          <li>המערכת לא קוראת את המיילים הנכנסים שלך.</li>
          <li>
            החיבור נשמר כ־Refresh Token מוצפן ב־DB, ואפשר לנתק אותו בכל רגע.
          </li>
        </ul>
      </div>
    </div>
  );
}
