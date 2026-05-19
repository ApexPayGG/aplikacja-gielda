import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
import { trackEvent } from "../utils/analytics";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      trackEvent("login");
      navigate("/", { replace: true });
    } catch (e) {
      const message = apiErrorMessage(e);
      if (message === "Please verify your email first") {
        setError("Sprawdź skrzynkę i kliknij link aktywacyjny");
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
    "Analityka AI dla świadomych decyzji inwestycyjnych",
    "Zautomatyzowane alerty i monitorowanie rynku 24/7",
    "Wgląd w portfel i wyniki w jednym miejscu",
  ];

  return (
    <div className="min-h-screen bg-bgPrimary">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-3xl bg-bgPrimary shadow-[0_24px_72px_rgba(45,10,107,0.2)] lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <img
              src="/logo.png"
              alt="StockAI Pro"
              className="mb-8 h-10 w-auto max-w-[min(100%,300px)] object-contain object-left"
            />
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-textPrimary">
                  {t("auth.loginTitle", { defaultValue: "Logowanie" })}
                </h1>
                <p className="mt-1 text-sm text-textSecondary">Zaloguj się, aby kontynuować pracę z platformą.</p>
              </div>

              {params.get("verified") === "true" ? (
                <p className="rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
                  Email zweryfikowany! Możesz się zalogować.
                </p>
              ) : null}

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
                <span>{t("auth.password", { defaultValue: "Hasło" })}</span>
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
                  Nie pamiętasz hasła?
                </Link>
              </p>

              {error ? <p className="text-sm text-negative">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brandDark px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading
                  ? t("auth.loginLoading", { defaultValue: "Logowanie..." })
                  : t("auth.loginButton", { defaultValue: "Zaloguj" })}
              </button>

              <p className="text-sm text-textSecondary">
                <Link to="/register" className="font-medium text-brandCyan">
                  {t("auth.registerLink", { defaultValue: "Nie masz konta? Zarejestruj się" })}
                </Link>
              </p>
            </form>
          </div>

          <aside
            className="hidden flex-col justify-center p-10 text-white lg:flex"
            style={{ background: `linear-gradient(140deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            <h2 className="text-2xl font-semibold">Dlaczego StockAI Pro?</h2>
            <p className="mt-2 text-sm text-white/85">Platforma inwestycyjna zbudowana dla nowoczesnych traderów.</p>
            <ul className="mt-8 space-y-3">
              {keyFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-white/95">
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
