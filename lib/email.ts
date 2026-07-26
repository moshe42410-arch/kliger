import nodemailer, { type Transporter } from "nodemailer";
import { getSql, getUserById, type User } from "./db";
import { v4 as uuid } from "uuid";

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: Buffer | string;
  contentType?: string;
}

/**
 * במודל החדש כל שליחת מייל נעשית ממייל הגוגל של היועץ המחובר, דרך OAuth2.
 * דורש 3 משתני סביבה גלובליים: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI
 * ולכל user: gmail_email + gmail_refresh_token (מתמלאים אחרי OAuth flow).
 *
 * Fallback (dev בלבד): אם מוגדרים SMTP_HOST/SMTP_USER/SMTP_PASSWORD בסביבה,
 * ואין למשתמש חיבור גוגל — נשתמש ב-SMTP הגלובלי (רק לנוחות פיתוח).
 */

function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

function fallbackSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  );
}

export function isEmailConfigured(): boolean {
  return googleOAuthConfigured() || fallbackSmtpConfigured();
}

/**
 * מייצר transporter פר־משתמש, על סמך refresh_token של הגוגל שלו.
 * אם אין למשתמש חיבור — נופל ל־SMTP הגלובלי (dev בלבד) או מחזיר null.
 */
async function getTransporterForUser(user: User | null): Promise<{
  transporter: Transporter | null;
  fromEmail: string;
  usingFallback: boolean;
}> {
  if (user && user.gmailEmail && googleOAuthConfigured()) {
    const sql = getSql();
    const rows = await sql`
      SELECT gmail_refresh_token FROM users WHERE id = ${user.id}
    `;
    const secret = rows[0] as
      | { gmail_refresh_token: string | null }
      | undefined;
    if (secret?.gmail_refresh_token) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: user.gmailEmail,
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          refreshToken: secret.gmail_refresh_token,
        },
      });
      return {
        transporter,
        fromEmail: user.gmailEmail,
        usingFallback: false,
      };
    }
  }

  // SMTP fallback only when Google OAuth is NOT configured at all,
  // or when explicitly allowed. Otherwise a broken SMTP silently masks
  // the real issue ("user has not connected Gmail").
  const allowSmtpFallback =
    process.env.ALLOW_SMTP_FALLBACK === "1" || !googleOAuthConfigured();

  if (allowSmtpFallback && fallbackSmtpConfigured()) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: (process.env.SMTP_SECURE ?? "true") === "true",
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASSWORD!,
      },
    });
    return {
      transporter,
      fromEmail:
        process.env.SMTP_FROM_EMAIL ||
        process.env.SMTP_USER ||
        user?.email ||
        "noreply@kliger.local",
      usingFallback: true,
    };
  }

  return { transporter: null, fromEmail: "", usingFallback: false };
}

export interface SendEmailOptions {
  to: string[];
  subject: string;
  body: string;
  reminderId?: string;
  clientId?: string;
  attachments?: EmailAttachment[];
  brandName?: string | null;
  brandSubtitle?: string | null;
  /** משתמש שממנו לשלוח את המייל. אם לא הועבר — ייכשל (אין ברירת מחדל). */
  fromUserId?: string | null;
  /** From name — ברירת מחדל: שם החברה של המשתמש, ואם אין — שמו. */
  fromNameOverride?: string | null;
  /** From email — לרוב לא משנים; ברירת מחדל = gmailEmail של המשתמש. */
  fromEmailOverride?: string | null;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{
  ok: boolean;
  error?: string;
}> {
  const sql = getSql();
  const user = opts.fromUserId ? await getUserById(opts.fromUserId) : null;
  const { transporter, fromEmail: defaultFromEmail } =
    await getTransporterForUser(user);

  const fromName =
    opts.fromNameOverride ||
    opts.brandName ||
    user?.companyName ||
    user?.name ||
    process.env.SMTP_FROM_NAME ||
    "KLIGER";
  const fromEmail = opts.fromEmailOverride || defaultFromEmail;

  const logId = uuid();
  const validRecipients = opts.to.filter((x) => x && x.includes("@"));

  const noTransport = !transporter || !fromEmail;
  if (noTransport || validRecipients.length === 0) {
    const errMsg = noTransport
      ? user
        ? "המשתמש טרם חיבר את חשבון הגוגל שלו"
        : "SMTP / Gmail לא מוגדרים"
      : "אין נמענים";
    await sql`
      INSERT INTO email_log (id, owner_id, reminder_id, client_id, to_addresses, subject, body, status, error)
      VALUES (${logId}, ${user?.id ?? null}, ${opts.reminderId ?? null}, ${opts.clientId ?? null}, ${JSON.stringify(validRecipients)}, ${opts.subject}, ${opts.body}, 'skipped', ${errMsg})
    `;
    return { ok: false, error: errMsg };
  }

  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const advisorLogoUrl =
    user?.logoFilename && appUrl
      ? user.logoFilename.startsWith("http")
        ? user.logoFilename
        : `${appUrl}/api/users/${user.id}/logo/image?v=${encodeURIComponent(user.logoFilename)}`
      : null;

  try {
    await transporter!.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: validRecipients.join(", "),
      subject: opts.subject,
      html: htmlWrap(opts.body, {
        advisorName: fromName,
        advisorLogoUrl,
        advisorSubtitle: opts.brandSubtitle ?? user?.phone ?? null,
      }),
      text: opts.body.replace(/<[^>]+>/g, ""),
      attachments: opts.attachments,
    });

    await sql`
      INSERT INTO email_log (id, owner_id, reminder_id, client_id, to_addresses, subject, body, status)
      VALUES (${logId}, ${user?.id ?? null}, ${opts.reminderId ?? null}, ${opts.clientId ?? null}, ${JSON.stringify(validRecipients)}, ${opts.subject}, ${opts.body}, 'sent')
    `;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sql`
      INSERT INTO email_log (id, owner_id, reminder_id, client_id, to_addresses, subject, body, status, error)
      VALUES (${logId}, ${user?.id ?? null}, ${opts.reminderId ?? null}, ${opts.clientId ?? null}, ${JSON.stringify(validRecipients)}, ${opts.subject}, ${opts.body}, 'error', ${msg})
    `;
    return { ok: false, error: msg };
  }
}

interface WrapOptions {
  advisorName: string;
  advisorLogoUrl: string | null;
  advisorSubtitle: string | null;
}

/**
 * מבנה המייל:
 * — הלוגו של היועץ + השם שלו בראש המייל, גדולים, במרכז.
 * — תוכן המייל בקוביה לבנה נקייה.
 * — בכל הפוטר: הערה עדינה "Powered by KLIGER" — טפל.
 * מיילים HTML חייבים inline styles + <table> לתמיכה טובה בכל לקוחות המייל.
 */
function htmlWrap(body: string, opts: WrapOptions): string {
  const paragraphs = body.split(/\n{2,}/).map((para) => {
    const linkified = linkifyUrls(para);
    const withBreaks = linkified.replace(/\n/g, "<br/>");
    return `<div dir="rtl" style="direction:rtl;text-align:right;unicode-bidi:embed;margin:0 0 14px 0;">\u200F${withBreaks}</div>`;
  });
  const safeBody = paragraphs.join("");
  const advisorSafe = escapeHtml(opts.advisorName);

  const advisorHeader = opts.advisorLogoUrl
    ? `<img src="${opts.advisorLogoUrl}" alt="${advisorSafe}" width="120" style="display:block;margin:0 auto 14px;max-width:120px;height:auto;border-radius:14px;border:1px solid rgba(217,168,37,0.25);"/>`
    : `<div style="width:64px;height:64px;margin:0 auto 14px;border-radius:14px;background:linear-gradient(135deg,#0a1932,#050e22);color:#f4d47c;font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;line-height:64px;text-align:center;border:1px solid rgba(217,168,37,0.35);">${advisorSafe.charAt(0).toUpperCase()}</div>`;

  const advisorSubtitle = opts.advisorSubtitle
    ? `<div style="color:#5a6a86;font-size:12px;margin-top:2px;letter-spacing:0.5px;">${escapeHtml(opts.advisorSubtitle)}</div>`
    : "";

  return `<!doctype html>
<html dir="rtl" lang="he">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${advisorSafe}</title>
  </head>
  <body dir="rtl" style="margin:0;padding:0;background:#f6f4ec;font-family:'Rubik',Arial,sans-serif;color:#0a1932;direction:rtl;text-align:right;">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ec;direction:rtl;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" dir="rtl" width="620" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(10,25,50,0.18);border:1px solid rgba(217,168,37,0.15);direction:rtl;">
            <tr>
              <td dir="rtl" align="center" style="padding:40px 32px 26px;background:linear-gradient(180deg,#fcfaf2 0%,#ffffff 100%);border-bottom:1px solid rgba(217,168,37,0.15);direction:rtl;text-align:center;">
                ${advisorHeader}
                <div dir="rtl" style="font-family:'Bellefair','Cormorant Garamond',Georgia,serif;color:#0a1932;font-size:22px;letter-spacing:0.5px;line-height:1.2;direction:rtl;text-align:center;">
                  ${advisorSafe}
                </div>
                ${advisorSubtitle}
              </td>
            </tr>

            <tr>
              <td dir="rtl" align="right" style="padding:32px 36px 36px;color:#1f2937;line-height:1.85;font-size:15px;text-align:right;direction:rtl;unicode-bidi:embed;">
                ${safeBody}
              </td>
            </tr>

            <tr>
              <td style="padding:0 36px;">
                <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(217,168,37,0.55),transparent);"></div>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:20px 32px 28px;">
                <div style="color:#8a95a6;font-size:10px;letter-spacing:0.35em;font-weight:500;text-transform:uppercase;">
                  Powered by
                  <span style="font-family:'Cormorant Garamond',Georgia,serif;color:#a67912;font-size:13px;letter-spacing:0.35em;font-weight:600;margin-right:4px;">KLIGER</span>
                </div>
              </td>
            </tr>
          </table>

          <p style="max-width:620px;margin:18px auto 0;text-align:center;color:#a0aab8;font-size:11px;line-height:1.6;">
            הודעה זו נשלחה על ידי ${advisorSafe} דרך פלטפורמת KLIGER לניהול יועצים.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function linkifyUrls(body: string): string {
  const urlRe = /(https?:\/\/[^\s<>"']+)/g;

  return body.replace(urlRe, (rawUrl) => {
    let url = rawUrl;
    let trailing = "";
    const trailingRe = /[.,;:!?)\]}\u200f\u200e]+$/;
    const m = url.match(trailingRe);
    if (m) {
      trailing = m[0];
      url = url.slice(0, url.length - trailing.length);
    }

    const safeHref = escapeHtml(url);
    const safeText = escapeHtml(url);

    const isUploadLink = /\/upload\//.test(url);

    if (isUploadLink) {
      const button = `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto;border-collapse:collapse;">
  <tr>
    <td align="center" style="background:linear-gradient(135deg,#3fbfaf 0%,#369989 55%,#265f58 100%);border-radius:14px;box-shadow:0 12px 28px -10px rgba(54,153,137,0.55);">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;color:#ffffff;font-family:'Rubik',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">📎 העלאת אסמכתא / צפייה בפרטים</a>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding-top:8px;">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:#6b7280;font-size:11px;font-family:'Rubik',Arial,sans-serif;text-decoration:underline;word-break:break-all;">${safeText}</a>
    </td>
  </tr>
</table>`;
      return button + trailing;
    }

    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:#369989;text-decoration:underline;word-break:break-all;">${safeText}</a>${trailing}`;
  });
}
