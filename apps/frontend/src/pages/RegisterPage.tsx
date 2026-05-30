import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";
import { ResendVerificationEmail } from "../components/ResendVerificationEmail";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setRegisteredEmail(null);
    setLoading(true);
    try {
      const result = await register(email, password, name);
      setRegisteredEmail(result.email);
      trackEvent("sign_up");
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-white outline-none transition placeholder:text-[#94a3b8] focus:border-[#22d3ee]/50 focus:ring-2 focus:ring-[#22d3ee]/20";
  const registrationBenefits = [
    t("auth.registerBenefit1", {
      defaultValue: "Personalized AI analysis and alerts",
    }),
    t("auth.registerBenefit2", {
      defaultValue: "One hub for portfolio monitoring and signals",
    }),
    t("auth.registerBenefit3", {
      defaultValue: "Faster decisions with automated market insights",
    }),
  ];

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 lg:px-8">
        <div className="glass-section grid w-full overflow-hidden rounded-3xl lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-textPrimary">
                  {t("auth.registerTitle", { defaultValue: "Sign up" })}
                </h1>
                <p className="mt-1 text-sm text-textSecondary">Start free · No credit card required</p>
              </div>

              {registeredEmail ? (
                <div className="space-y-3 rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
                  <p>
                    {t("auth.registerCheckEmail", {
                      email: registeredEmail ?? "",
                      defaultValue: "Check your inbox — we sent an activation link to {{email}}",
                    })}
                  </p>
                  <ResendVerificationEmail email={registeredEmail} className="text-positive" />
                </div>
              ) : null}

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.nameOptional", { defaultValue: "Name (optional)" })}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} />
              </label>

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.email", { defaultValue: "Email" })}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.passwordMin", { defaultValue: "Password (min. 8 characters)" })}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClassName}
                />
              </label>

              {error ? <p className="text-sm text-negative">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brandDark px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading
                  ? t("auth.registerLoading", { defaultValue: "Creating account..." })
                  : t("auth.registerButton", { defaultValue: "Create account" })}
              </button>

              <p className="text-sm text-textSecondary">
                <Link to="/login" className="font-medium text-brandCyan">
                  {t("auth.loginLink", { defaultValue: "Already have an account? Sign in" })}
                </Link>
              </p>
              <p className="text-xs leading-relaxed text-textSecondary">
                {t("auth.registerAcceptTermsLead", { defaultValue: "By signing up you accept our" })}{" "}
                <Link to="/terms" className="font-medium text-brandCyan hover:underline">
                  {t("auth.registerTermsLink", { defaultValue: "Terms of Service" })}
                </Link>{" "}
                {t("auth.registerAndWord", { defaultValue: "and" })}{" "}
                <Link to="/privacy" className="font-medium text-brandCyan hover:underline">
                  {t("auth.registerPrivacyLink", { defaultValue: "Privacy Policy" })}
                </Link>
                .
              </p>
            </form>
          </div>

          <aside
            className="hidden flex-col justify-center p-10 text-white lg:flex"
            style={{ background: `linear-gradient(140deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            <h2 className="text-2xl font-semibold">{t("auth.registerBenefitsAsideTitle", { defaultValue: "Benefits of signing up" })}</h2>
            <p className="mt-2 text-sm text-white/85">
              {t("auth.registerBenefitsAsideSubtitle", { defaultValue: "Join StockAI Pro and invest with more clarity." })}
            </p>
            <ul className="mt-8 space-y-4">
              {registrationBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-white/95">
                  <span className="mt-0.5 rounded-full border border-brandCyan/60 bg-white/10 px-1.5 text-xs text-brandCyan">
                    ✓
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
