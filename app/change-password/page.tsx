import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        aria-hidden
        className="blob blob-gold w-[500px] h-[500px] -top-32 -right-32 opacity-30"
      />
      <div
        aria-hidden
        className="blob blob-teal w-[400px] h-[400px] -bottom-24 -left-24 opacity-25"
      />
      <div className="w-full max-w-md relative">
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="mx-auto w-20 h-20 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kliger-mark.svg"
              alt="KLIGER"
              className="w-full h-full drop-shadow-[0_18px_40px_rgba(217,168,37,0.35)]"
            />
          </div>
          <h1 className="text-3xl font-heading mb-2 text-navy-950">
            {user.mustChangePassword ? "החלפת סיסמה" : "שינוי סיסמה"}
          </h1>
          <p className="text-sm text-navy-600">
            {user.mustChangePassword
              ? "בכניסה הראשונה — בבקשה בחר סיסמה חדשה"
              : `שלום ${user.name}`}
          </p>
        </div>

        <ChangePasswordForm forced={user.mustChangePassword} />
      </div>
    </div>
  );
}
