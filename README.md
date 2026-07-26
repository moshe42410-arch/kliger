# KLIGER - מערכת ניהול העברות והפקדות

> עובדים חכם · עובדים נכון

מערכת רב-משתמשית (SaaS) לניהול לקוחות, הפקדות ותזכורות אוטומטיות. כל יועץ מקבל
משתמש משלו, שולח מיילים מהחשבון שלו (דרך Google OAuth), ורואה רק את הלקוחות שלו.

---

## 🚀 העלאה לאויר (Vercel חינמי)

→ **ראה [`DEPLOY.md`](./DEPLOY.md)** למדריך מלא בעברית שלב אחר שלב.

הכל חינם: קוד ב-Vercel, DB ב-Neon Postgres, אחסון קבצים ב-Vercel Blob.

---

## תכולת המערכת

### לשונית לקוחות
- הוספה, עריכה ומחיקה של לקוחות
- שדות: שם, מיילים מרובים, טלפונים מרובים
- ערוץ תזכורת: מייל / טלפון / שניהם

### לשונית הפקדות
- 4 סוגי הפקדה: משכורת / מלגה מכולל / העברה פרטית / מזומן-שיק
- בחירת אחריות: על היועץ / על הלקוח
- בחירת נמען תזכורת: יועץ / לקוח / שניהם
- הגדרת יום בחודש + כמה ימים לפני לשלוח תזכורת

### לשונית תזכורות
- 5 קטגוריות: ממתין ללקוח, ממתין ליועץ, ממתין לעמותה, בהמתנה, טופל
- שליחה מיידית, הודעת מייל חופשית, דחייה, סימון "שולם", העברה לעמותה
- רולאובר חודשי אוטומטי

### מיילים אישיים
- כל יועץ מחבר את חשבון Gmail שלו (OAuth) → מיילים נשלחים מהחשבון שלו
- ניסוח מיילים ניתן להתאמה בהגדרות (עם משתנים דינמיים)
- כניסה למערכת גם עם Google (בלחיצה)

### מעטפת מנהל (Admin)
- אדמין יכול לפתוח משתמשים חדשים ליועצים אחרים
- שליחת מייל הזמנה אוטומטית עם סיסמה זמנית
- איפוס סיסמאות, השבתת חשבונות, מחיקה

---

## דרישות מערכת

- **Node.js 22+** (חייב לפחות 22.5 בגלל `node:sqlite` בסקריפטים ישנים - כעת לא נדרש בפועל)
- **DATABASE_URL** של Neon Postgres (חינמי)
- **Google OAuth** credentials (חינמי)

---

## התקנה והפעלה מקומית

### 1. התקנת חבילות

```powershell
npm install
```

### 2. יצירת `.env.local`

העתק את `.env.local.example` ל-`.env.local` ומלא לפחות:

```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
APP_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
ADMIN_NAME=מנהל המערכת
ADMIN_INITIAL_PASSWORD=change-me
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

### 3. הכן את הסכימה ב-Neon

פתח את [console.neon.tech](https://console.neon.tech) → SQL Editor → הדבק את
כל התוכן של `scripts/schema-postgres.sql` → Run.

### 4. הפעלה

```powershell
npm run dev
```

פתח בדפדפן: <http://localhost:3000>

בכניסה הראשונה - הזן `ADMIN_EMAIL` + `ADMIN_INITIAL_PASSWORD`. המערכת תבקש
להחליף סיסמה.

---

## מבנה הפרויקט

```
KLIGER/
├── app/                       # Next.js App Router
│   ├── page.tsx               # דשבורד ראשי
│   ├── layout.tsx             # תפריט + הרשאות
│   ├── clients/               # לשונית לקוחות
│   ├── deposits/              # לשונית הפקדות
│   ├── reminders/             # לשונית תזכורות
│   ├── associations/          # לשונית עמותות
│   ├── admin/users/           # ניהול משתמשים (admin)
│   ├── settings/              # הגדרות פרופיל, לוגו, ניסוח
│   ├── login/                 # מסך כניסה
│   ├── change-password/       # החלפת סיסמה
│   ├── upload/[token]/        # עמוד ציבורי להעלאת אסמכתאות
│   └── api/                   # REST API + Vercel Cron
│       └── cron/reminders/    # שליחה יומית (Vercel Cron)
├── components/                # קומפוננטות React
├── lib/
│   ├── db.ts                  # Neon Postgres (async)
│   ├── auth.ts                # ניהול הרשאות + sessions
│   ├── email.ts               # שליחת מיילים (Gmail OAuth)
│   ├── reminders.ts           # לוגיקת התזכורות
│   ├── blob-storage.ts        # Vercel Blob (או fs מקומי בפיתוח)
│   ├── scheduler.ts           # node-cron אופציונלי לפיתוח
│   ├── google-oauth.ts        # OAuth helpers
│   └── email-templates.ts     # תבניות המייל
├── scripts/
│   ├── schema-postgres.sql    # הסכימה של ה-DB
│   ├── reset-db.mjs           # רענון DB במקומי
│   └── migrate-sqlite-to-pg.mjs   # (עזר - הגירת נתונים ישנים)
├── vercel.json                # הגדרות Vercel + Cron
├── DEPLOY.md                  # מדריך העלאה
└── .env.local.example         # רשימת משתני סביבה
```

---

## אבטחה

- כל הסיסמאות נשמרות מוצפנות (scrypt)
- Sessions לפי cookies HTTP-only
- כל בקשת API מפולטרת לפי `owner_id` (בידוד מלא בין יועצים)
- Google OAuth לשליחת מיילים (בלי לשמור סיסמאות Gmail)

---

## גיבוי

**ב-Vercel**: הכל בענן, אין מה לגבות ידנית.
- DB: Neon עושה גיבויים אוטומטיים (7 ימים אחורה בחשבון החינמי)
- קבצים: Vercel Blob אוטומטי

**ב-dev מקומי**:
1. גבה את `.env.local`
2. הנתונים נמצאים ב-Neon (אין קובץ מקומי)

---

**KLIGER** · עובדים חכם · עובדים נכון
