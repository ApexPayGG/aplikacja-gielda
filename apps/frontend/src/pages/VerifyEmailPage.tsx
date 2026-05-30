import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ResendVerificationEmail } from "../components/ResendVerificationEmail";
import { verifyEmailToken } from "../services/api";

type VerificationState = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<VerificationState>("loading");
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    let active = true;
    async function run(): Promise<void> {
      if (!token.trim()) {
        if (active) setState("error");
        return;
      }
      try {
        const result = await verifyEmailToken(token);
        if (!active) return;
        setState(result.verified ? "success" : "error");
      } catch {
        if (active) setState("error");
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="neo-panel w-full space-y-4 rounded-xl p-6 text-center">
        {state === "loading" ? (
          <p className="text-sm text-slate-300">{t("auth.verifyEmailWorking", { defaultValue: "Verifying email…" })}</p>
        ) : null}
        {state === "success" ? (
          <>
            <p className="text-base font-semibold text-brand-green">{t("auth.verifyEmailSuccess")}</p>
            <Link to="/login" className="inline-block rounded bg-brand-blue px-4 py-2 font-semibold text-brand-bg">
              Login
            </Link>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <p className="text-base font-semibold text-brand-red">{t("auth.verifyEmailInvalidLink")}</p>
            <label className="block space-y-1.5 text-left text-sm text-slate-300">
              <span>{t("auth.email", { defaultValue: "Email" })}</span>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full rounded border border-white/12 bg-white/5 px-3 py-2 text-white"
                placeholder={t("auth.resendVerificationEmailPlaceholder", { defaultValue: "your@email.com" })}
              />
            </label>
            {resendEmail.trim() ? <ResendVerificationEmail email={resendEmail} className="text-left" /> : null}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/login" className="inline-block rounded bg-brand-blue px-4 py-2 font-semibold text-brand-bg">
                {t("auth.backToLogin", { defaultValue: "Back to login" })}
              </Link>
              <Link to="/register" className="inline-block rounded bg-slate-700 px-4 py-2 font-semibold text-white">
                {t("auth.verifyBackRegister", { defaultValue: "Back to sign up" })}
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
