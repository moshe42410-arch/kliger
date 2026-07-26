# מדריך העלאת KLIGER לאויר - Vercel (חינם)

**זמן משוער: 20-30 דקות** (כולל הרשמות ל-Neon / Vercel / Google Cloud)

הכל חינם לחלוטין. גם ה-DB, גם האחסון, גם המערכת.

---

## שלב 1: הכן את הקוד ל-Git (דקה)

בטרמינל, מתוך `c:\Users\moshe\KLIGER`:

```bash
git init
git add .
git commit -m "Initial commit - ready for deployment"
```

**אם git כבר הופעל בעבר** ואתה רואה שגיאה, פשוט תריץ רק את שתי השורות האחרונות.

---

## שלב 2: העלה ל-GitHub (2 דקות)

### 2.1 צור repository חדש

1. לך ל: **https://github.com/new**
2. תן שם: `kliger` (או מה שמתאים)
3. **אל תסמן** "Add README"
4. לחץ **"Create repository"**

### 2.2 חבר את הקוד המקומי ל-GitHub

GitHub יראה לך הוראות. **הרץ בטרמינל** (החלף `YOUR_USERNAME`):

```bash
git remote add origin https://github.com/YOUR_USERNAME/kliger.git
git branch -M main
git push -u origin main
```

---

## שלב 3: פתח Neon (DB חינמי) - 3 דקות

**Neon** = Postgres בענן, חינם לגמרי (עד 3GB, מספיק לשנים).

1. לך ל: **https://console.neon.tech**
2. הירשם עם GitHub (הכי מהיר)
3. לחץ **"Create Project"**
   - Name: `kliger`
   - Region: `Europe (Frankfurt)` - הכי קרוב לישראל
   - Postgres version: `16`
4. אחרי היצירה תראה **Connection String** במסך. העתק אותו (זה מתחיל ב-`postgresql://...`).

### 3.1 צור את הסכימה (הטבלאות)

1. בתפריט השמאלי לחץ **"SQL Editor"**
2. פתח בעורך את הקובץ **`scripts/schema-postgres.sql`** בפרויקט שלך
3. העתק את **כל התוכן** והדבק בעורך של Neon
4. לחץ **"Run"** — תראה "Success" ליד כל טבלה

---

## שלב 4: הגדר Google OAuth (5 דקות)

זה מה שמאפשר ליועצים לשלוח מיילים ולהיכנס עם Google.

**אם כבר יש לך CLIENT_ID + SECRET מהפעם הקודמת - דלג לשלב 5.**

1. לך ל: **https://console.cloud.google.com/**
2. צור פרויקט חדש (למעלה) → תן שם `KLIGER`
3. תפריט: **"APIs & Services" → "Library"** → חפש `Gmail API` → **Enable**
4. תפריט: **"APIs & Services" → "OAuth consent screen"**:
   - User Type: **External**
   - App name: `KLIGER`
   - הזן מייל תמיכה + מייל שלך
   - **Scopes** → Add: `.../auth/gmail.send` וגם `userinfo.email`
   - **Test users** → הוסף את המייל שלך
5. תפריט: **"APIs & Services" → "Credentials"** → **"Create Credentials" → "OAuth Client ID"**:
   - Application type: **Web application**
   - **Authorized redirect URIs** — הוסף את שני אלו:
     - `http://localhost:3000/api/auth/google/callback` (לפיתוח)
     - `https://YOUR-PROJECT.vercel.app/api/auth/google/callback` (תדע את זה רק אחרי Vercel, מוסיפים אחר-כך)
6. לחץ **Create**. תקבל **Client ID** + **Client Secret** — שמור אותם.

---

## שלב 5: חבר ל-Vercel (5 דקות)

1. לך ל: **https://vercel.com**
2. הירשם עם GitHub
3. במסך הראשי לחץ **"Add New" → "Project"**
4. תראה את ה-repositories שלך. בחר את `kliger` → **"Import"**

### 5.1 הגדרות פרויקט

Vercel יזהה אוטומטית "Next.js". **אל תשנה כלום** ב-Build/Output.

### 5.2 הוסף Environment Variables (חשוב!)

לחץ **"Environment Variables"** והוסף אחד אחד:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Connection String של Neon (מהשלב הקודם) |
| `APP_URL` | ריק בינתיים - נמלא אחרי ה-Deploy |
| `ADMIN_EMAIL` | המייל שלך (למשל `moshe42410@gmail.com`) |
| `ADMIN_NAME` | השם שלך (למשל `משה קליגר`) |
| `ADMIN_INITIAL_PASSWORD` | סיסמה זמנית (למשל `Kliger2026!`) |
| `GOOGLE_CLIENT_ID` | מ-Google Cloud |
| `GOOGLE_CLIENT_SECRET` | מ-Google Cloud |
| `CRON_SECRET` | סיסמה אקראית (למשל `zx8k9m2p...`) - מגן על ה-cron |

### 5.3 לחץ Deploy!

Vercel יבנה את האתר. **1-3 דקות**.

---

## שלב 6: אחרי Deploy ראשון - שלמה שני שדות (2 דקות)

תקבל כתובת (למשל: `https://kliger-abc.vercel.app`). עכשיו:

### 6.1 חזור ל-Vercel → Settings → Environment Variables

- **APP_URL**: הכתובת של האתר (`https://kliger-abc.vercel.app`) → Save
- לחץ **"Deployments" → Redeploy** (למעלה מימין)

### 6.2 חזור ל-Google Cloud → Credentials → OAuth Client ID

הוסף ל-**Authorized redirect URIs**:
- `https://kliger-abc.vercel.app/api/auth/google/callback`

לחץ **Save**.

---

## שלב 7: חבר Vercel Blob (אחסון קבצים) - 2 דקות

זה איפה קבצי לוגו + אסמכתאות ישמרו.

1. ב-Vercel, בפרויקט שלך → **Storage** (בסרגל העליון)
2. לחץ **"Create Database" → "Blob"**
3. שם: `kliger-files` → **Create**
4. Vercel מוסיף אוטומטית את `BLOB_READ_WRITE_TOKEN` למשתני הסביבה

צריך עוד Redeploy אחד: **Deployments → Redeploy**.

---

## שלב 8: התחבר וסיימת! 🎉

1. לך לכתובת של האתר
2. לחץ **"התחברות"**
3. הזן: המייל שלך + הסיסמה שהגדרת ב-`ADMIN_INITIAL_PASSWORD`
4. המערכת תבקש להחליף סיסמה - החלף
5. לחץ על התפריט (למעלה) → **"הגדרות" → "חיבור למייל"**
6. לחץ **"התחבר עם Google"** — אשר, ומעכשיו כל מייל יישלח מהחשבון שלך

---

## ✅ סיכום מהיר

1. ✅ `git init` + `git add .` + `git commit`
2. ✅ העלה ל-GitHub
3. ✅ פתח Neon + הרץ schema-postgres.sql
4. ✅ הגדר Google OAuth (Client ID + Secret)
5. ✅ Vercel: Import מ-GitHub + Environment Variables
6. ✅ אחרי Deploy: עדכן APP_URL + Google redirect
7. ✅ הוסף Vercel Blob (Storage tab)
8. ✅ Redeploy אחרון + כניסה ראשונה

---

## ❓ בעיות נפוצות

**"DATABASE_URL is not set"**
- לא הוספת את המשתנה ב-Vercel Environment Variables, או שכתבת אותו לא נכון.
- ודא שאתה משתמש ב-**pooled connection string** מ-Neon (בדף Overview).

**"מייל או סיסמה שגויים" בכניסה הראשונה**
- ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD לא הוגדרו נכון ב-Vercel.
- Redeploy אחרי שינוי משתני סביבה.

**"Redirect URI mismatch" בזמן Google login**
- לא הוספת את כתובת Vercel לרשימת ה-Redirect URIs ב-Google Cloud.
- ודא שהכתבת בדיוק: `https://YOUR-DOMAIN.vercel.app/api/auth/google/callback`

**הלוגו/קבצים לא נטענים**
- Vercel Blob לא חובר. חזור לשלב 7.

---

## 🔄 עדכון עתידי

כשאתה משנה קוד וגורם ל-`git push` — Vercel אוטומטית בונה מחדש. **בלי צורך לעשות כלום.**
