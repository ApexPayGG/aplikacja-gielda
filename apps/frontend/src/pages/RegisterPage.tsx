import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../styles/designSystem";
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
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan";
  const registrationBenefits = [
    "Dostęp do personalizowanych analiz AI i alertów",
    "Jedno miejsce do monitorowania portfela i sygnałów",
    "Szybsze decyzje dzięki automatycznym insightom rynkowym",
  ];

  return (
    <div className="min-h-screen bg-bgPrimary">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-3xl bg-bgPrimary shadow-[0_24px_72px_rgba(45,10,107,0.2)] lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            <img src="/logo.png" alt="StockAI Pro" className="mb-8 h-10 w-48 object-cover object-center" />
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-textPrimary">
                  {t("auth.registerTitle", { defaultValue: "Rejestracja" })}
                </h1>
                <p className="mt-1 text-sm text-textSecondary">Start free · No credit card required</p>
              </div>

              {registeredEmail ? (
                <p className="rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
                  Sprawdź swoją skrzynkę - wysłaliśmy link aktywacyjny na {registeredEmail}
                </p>
              ) : null}

              <label className="block space-y-1.5 text-sm text-textSecondary">
                <span>{t("auth.nameOptional", { defaultValue: "Imię (opcjonalnie)" })}</span>
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
                <span>{t("auth.passwordMin", { defaultValue: "Hasło (min. 8 znaków)" })}</span>
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
                  ? t("auth.registerLoading", { defaultValue: "Rejestracja..." })
                  : t("auth.registerButton", { defaultValue: "Utwórz konto" })}
              </button>

              <p className="text-sm text-textSecondary">
                <Link to="/login" className="font-medium text-brandCyan">
                  {t("auth.loginLink", { defaultValue: "Masz już konto? Zaloguj się" })}
                </Link>
              </p>
            </form>
          </div>

          <aside
            className="hidden flex-col justify-center p-10 text-white lg:flex"
            style={{ background: `linear-gradient(140deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            <h2 className="text-2xl font-semibold">Korzyści z rejestracji</h2>
            <p className="mt-2 text-sm text-white/85">Dołącz do AMC Energy powered by StockAI Pro i rozwijaj przewagę.</p>
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
