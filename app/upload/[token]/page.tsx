import {
  getSql,
  getUserById,
  userAsAdvisor,
  parseClient,
  parseDeposit,
  parseReminder,
  type ClientRow,
  type DepositRow,
  type ReminderRow,
} from "@/lib/db";
import { UploadForm } from "@/components/UploadForm";
import { depositTypeLabel } from "@/lib/types";
import { AlertCircle, CheckCircle2, Calendar, Banknote, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: { token: string };
}) {
  const sql = getSql();
  const rRows = await sql`SELECT * FROM reminders WHERE upload_token = ${params.token}`;
  const rRow = rRows[0] as ReminderRow | undefined;

  if (!rRow) {
    return (
      <UploadShell advisorName="KLIGER" logoUserId={null}>
        <div className="card text-center py-12 relative overflow-hidden">
          <div className="blob blob-teal w-64 h-64 -top-20 -left-20 opacity-30" />
          <div className="relative">
            <div className="inline-flex p-4 rounded-2xl kpi-icon rose mb-4">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-fluid-2xl font-heading font-bold text-navy-950 mb-3">
              קישור לא תקין
            </h1>
            <p className="text-navy-700 max-w-md mx-auto">
              הקישור שלחצת עליו אינו קיים או שפג תוקפו.
              <br />
              אנא פנה אלינו לקבלת קישור חדש.
            </p>
          </div>
        </div>
      </UploadShell>
    );
  }

  const reminder = parseReminder(rRow);
  const ownerUser = await getUserById(reminder.ownerId);
  const advisor = ownerUser ? userAsAdvisor(ownerUser) : null;
  const [cRows, dRows, uploadCountRows] = await Promise.all([
    sql`SELECT * FROM clients WHERE id = ${reminder.clientId}`,
    sql`SELECT * FROM deposits WHERE id = ${reminder.depositId}`,
    sql`SELECT COUNT(*)::int as c FROM uploads WHERE reminder_id = ${reminder.id}`,
  ]);
  const cRow = (cRows as ClientRow[])[0];
  const dRow = (dRows as DepositRow[])[0];
  const client = cRow ? parseClient(cRow) : null;
  const deposit = dRow ? parseDeposit(dRow) : null;

  const label = deposit ? depositTypeLabel[deposit.depositType] : "";

  const uploadsCount = Number(
    (uploadCountRows as Array<{ c: number }>)[0]?.c ?? 0
  );

  const alreadyUsed = uploadsCount > 0 || reminder.status === "resolved";
  const brandName = advisor?.companyName || advisor?.name || "KLIGER";
  const logoUserId = advisor?.logoFilename ? advisor.id : null;

  return (
    <UploadShell advisorName={brandName} logoUserId={logoUserId} logoFilename={advisor?.logoFilename ?? null}>
      {alreadyUsed ? (
        <div className="card text-center py-12 relative overflow-hidden animate-fade-in-up">
          <div className="blob blob-gold w-64 h-64 -top-20 -right-20 opacity-40" />
          <div className="relative">
            <div className="inline-flex p-5 rounded-2xl kpi-icon green mb-4">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-fluid-2xl font-heading font-bold text-navy-950 mb-3">
              האסמכתא כבר התקבלה
            </h1>
            <p className="text-navy-700 mb-2 max-w-md mx-auto">
              קישור זה שימש כבר להעלאת אסמכתא בהצלחה.
            </p>
            <p className="text-navy-500 text-sm max-w-md mx-auto">
              במידה ויש צורך לעדכן או להוסיף קבצים נוספים - אנא פנה אלינו ונשלח
              קישור חדש.
            </p>
          </div>
        </div>
      ) : (
        <div className="card card-gold relative overflow-hidden animate-fade-in-up">
          <div className="blob blob-gold w-72 h-72 -top-24 -right-24 opacity-30" />

          <div className="relative">
            <h1 className="text-fluid-2xl font-heading font-bold text-navy-950 mb-2">
              העלאת אסמכתא
            </h1>
            {client && (
              <p className="text-navy-700 mb-4 text-fluid-base">
                שלום{" "}
                <span className="font-heading font-bold text-navy-950">
                  {client.name}
                </span>
                ,
              </p>
            )}

            {deposit && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <DetailCard
                  icon={Banknote}
                  label="סוג"
                  value={label}
                />
                <DetailCard
                  icon={Banknote}
                  label="סכום"
                  value={new Intl.NumberFormat("he-IL", {
                    style: "currency",
                    currency: "ILS",
                    maximumFractionDigits: 0,
                  }).format(deposit.amount)}
                />
                <DetailCard
                  icon={Calendar}
                  label="תאריך יעד"
                  value={new Date(reminder.targetDate).toLocaleDateString(
                    "he-IL"
                  )}
                />
              </div>
            )}

            <UploadForm token={params.token} />

            <div className="mt-6 flex items-center gap-2 text-xs text-navy-600 justify-center">
              <ShieldCheck size={14} className="text-teal-600" />
              <span>ההעלאה מוצפנת ומועברת ישירות לצוות {brandName}</span>
            </div>
          </div>
        </div>
      )}
    </UploadShell>
  );
}

function UploadShell({
  advisorName,
  logoUserId,
  logoFilename = null,
  children,
}: {
  advisorName: string;
  logoUserId: string | null;
  logoFilename?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen py-8 sm:py-12 px-4 relative overflow-hidden">
      <div
        aria-hidden
        className="blob blob-gold w-96 h-96 top-0 -right-20 opacity-25"
      />
      <div
        aria-hidden
        className="blob blob-teal w-96 h-96 bottom-0 -left-20 opacity-20"
      />
      <div className="max-w-2xl mx-auto relative">
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="mx-auto w-32 sm:w-36 mb-5">
            {logoUserId && logoFilename ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/users/${logoUserId}/logo/image?v=${encodeURIComponent(logoFilename)}`}
                alt={advisorName}
                className="w-full h-auto rounded-2xl border border-gold-400/40 shadow-[0_20px_50px_-15px_rgba(0,33,71,0.25)] bg-white object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/kliger-mark.svg"
                alt={advisorName}
                className="w-full h-auto drop-shadow-[0_18px_40px_rgba(217,168,37,0.3)]"
              />
            )}
          </div>
          <h2 className="font-heading text-2xl text-navy-950 mb-1">
            {advisorName}
          </h2>
          <div className="mx-auto my-3 h-px w-16 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
          <div className="text-[10px] text-gold-700 tracking-[0.35em] font-medium uppercase">
            Secure Document Upload
          </div>
        </div>

        {children}

        <p className="text-center text-[11px] text-navy-500 mt-8">
          מסך זה מאובטח. אל תעביר את הקישור לאחרים.
          <br/>
          <span className="text-navy-400">Powered by <span className="font-brand tracking-[0.25em] text-gold-700">KLIGER</span></span>
        </p>
      </div>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl p-3 bg-white border border-navy-950/8 text-center shadow-sm">
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-navy-600 mb-1 font-medium">
        <Icon size={12} className="text-teal-600" />
        {label}
      </div>
      <div className="text-sm font-heading font-bold text-navy-950 truncate">
        {value}
      </div>
    </div>
  );
}
