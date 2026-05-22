import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmailToken } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type VerificationState = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<VerificationState>("loading");

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
      } catch (error) {
        void apiErrorMessage(error);
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
            <Link to="/register" className="inline-block rounded bg-slate-700 px-4 py-2 font-semibold text-white">
              {t("auth.verifyBackRegister", { defaultValue: "Back to sign up" })}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
