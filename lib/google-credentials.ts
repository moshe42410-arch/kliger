/**
 * Google OAuth client credentials — trim + clear invalid_client errors.
 */

export function getGoogleOAuthClient(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function explainGoogleTokenError(responseText: string): string {
  if (responseText.includes("invalid_client")) {
    return (
      "סוד Google (CLIENT_SECRET) לא תואם ל-Client ID. " +
      "עדכנו ב-.env.local / Vercel את GOOGLE_CLIENT_SECRET מהסוד העדכני ב-Google Cloud Console " +
      "(Credentials → OAuth 2.0 Client), הפעילו מחדש, ואז בהגדרות נתקו וחברו מחדש."
    );
  }
  if (responseText.includes("invalid_grant")) {
    return (
      "חיבור Google פג תוקף או חסרות הרשאות Drive. " +
      "בהגדרות → נתקו וחברו מחדש (יינתן גם אישור לקריאת דרייב)."
    );
  }
  return `רענון טוקן Google נכשל: ${responseText.slice(0, 180)}`;
}
