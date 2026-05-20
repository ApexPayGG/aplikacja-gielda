import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";
import { BrandLogo } from "../components/BrandLogo";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function safeRedirectPath(from: unknown): string {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
    return "/dashboard";
  }
  return from;
}

export function LoginPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectFrom = safeRedirectPath((location.state as { from?: string } | null)?.from);
  const isCheckoutReturn = redirectFrom.startsWith("/pricing");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      trackEvent("login");
      navigate(redirectFrom, { replace: true });
    } catch (e) {
      const message = apiErrorMessage(e);
      if (message === "Please verify your email first") {
        setError(t("auth.verifyEmailFirst"));
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan";
  const keyFeatures = [
    t("auth.loginAsideFeature1"),
    t("auth.loginAsideFeature2"),
    t("auth.loginAsideFeature3"),
  ];

  return (
    <div className="min-h-screen bg-bgPrimary">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-3xl bg-bgPrimary shadow-[0_24px_72px_rgba(45,10,107,0.2)] lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <BrandLogo size="auth" className="mb-8" />
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-textPrimary">{t("auth.signIn")}</h1>
                <p className="mt-1 text-sm text-textSecondary">{t("auth.signInSubtitle")}</p>
              </div>

              {isCheckoutReturn ? (
                <p className="rounded-xl border border-brandCyan/30 bg-brandCyan/10 px-3 py-2 text-sm text-brandDark">
                  {t("auth.loginContinueCheckout")}
                </p>
              ) : null}

              {params.get("verified") === "true" ? (
                <p className="rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
                  {t("auth.verifyEmailSuccess")}
                </p>
              ) : null}

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.email")}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClassName}
                />
              </label>

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.password")}</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClassName}
                />
              </label>

              <p className="text-right text-sm text-textSecondary">
                <Link to="/forgot-password" className="font-medium text-brandCyan">
                  {t("auth.forgotPassword")}
                </Link>
              </p>

              {error ? <p className="text-sm text-negative">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brandDark px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? t("auth.loginLoading") : t("auth.signIn")}
              </button>

              <p className="text-sm text-textSecondary">
                <Link to="/register" className="font-medium text-brandCyan">
                  {t("auth.noAccount")}
                </Link>
              </p>
            </form>
          </div>

          <aside
            className="hidden flex-col justify-center p-10 text-white lg:flex"
            style={{ background: `linear-gradient(140deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            <BrandLogo size="auth" className="mb-8 brightness-110" />
            <h2 className="text-2xl font-semibold">{t("auth.loginAsideTitle")}</h2>
            <p className="mt-2 text-sm text-white/85">{t("auth.loginAsideSubtitle")}</p>
            <ul className="mt-8 space-y-3">
              {keyFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-white/95">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-brandCyan" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
