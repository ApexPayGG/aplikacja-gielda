import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resendVerificationEmail } from "../services/api";

type ResendState = "idle" | "sending" | "sent";

type ResendVerificationEmailProps = {
  email: string;
  className?: string;
};

export function ResendVerificationEmail({ email, className = "" }: ResendVerificationEmailProps) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<ResendState>("idle");

  const normalizedEmail = email.trim();
  const canSend = normalizedEmail.length > 0 && state !== "sending";

  async function onResend(): Promise<void> {
    if (!canSend) return;
    setState("sending");
    try {
      await resendVerificationEmail(normalizedEmail);
      setState("sent");
    } catch {
      setState("idle");
    }
  }

  return (
    <div className={`space-y-2 text-sm ${className}`.trim()}>
      <button
        type="button"
        disabled={!canSend}
        onClick={() => void onResend()}
        className="font-medium text-brandCyan hover:underline disabled:opacity-60"
      >
        {state === "sending"
          ? t("auth.resendVerificationSending", { defaultValue: "Sending…" })
          : t("auth.resendVerificationButton", { defaultValue: "Resend verification email" })}
      </button>
      {state === "sent" ? (
        <p className="text-textSecondary">
          {t("auth.resendVerificationSent", {
            defaultValue: "If this email exists, we’ll send a new verification link.",
          })}
        </p>
      ) : null}
    </div>
  );
}
