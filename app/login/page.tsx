import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const user = await getCurrentUser();
  if (user) {
    if (user.mustChangePassword) redirect("/change-password");
    redirect(searchParams.next || "/");
  }

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
          <div className="mx-auto w-24 h-24 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kliger-mark.svg"
              alt="KLIGER"
              className="w-full h-full drop-shadow-[0_18px_40px_rgba(217,168,37,0.35)]"
            />
          </div>
          <h1 className="brand-wordmark text-4xl mb-3">KLIGER</h1>
          <div className="brand-tagline">FINANCIAL ADVISORY</div>
          <div className="mt-6 mb-2 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-gold-500 to-transparent"/>
          <p className="text-navy-700 text-sm mt-4">
            כניסה למערכת ניהול היועצים
          </p>
        </div>

        <LoginForm
          notice={searchParams.notice ?? null}
          next={searchParams.next ?? null}
        />
      </div>
    </div>
  );
}
