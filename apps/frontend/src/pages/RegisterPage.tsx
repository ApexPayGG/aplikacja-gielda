import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="neo-panel w-full space-y-4 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">{t("auth.registerTitle", { defaultValue: "Rejestracja" })}</h1>
        <p className="text-sm text-slate-400">Start free · No credit card required</p>
        {registeredEmail ? (
          <p className="rounded border border-brand-green/40 bg-brand-green/10 px-3 py-2 text-sm text-brand-green">
            Sprawdź swoją skrzynkę - wysłaliśmy link aktywacyjny na {registeredEmail}
          </p>
        ) : null}
        <label className="block space-y-1 text-sm text-slate-300">
          <span>{t("auth.nameOptional", { defaultValue: "Imię (opcjonalnie)" })}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-300">
          <span>{t("auth.email", { defaultValue: "Email" })}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-300">
          <span>{t("auth.passwordMin", { defaultValue: "Hasło (min. 8 znaków)" })}</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand-green px-4 py-2 font-semibold text-brand-bg disabled:opacity-60"
        >
          {loading
            ? t("auth.registerLoading", { defaultValue: "Rejestracja..." })
            : t("auth.registerButton", { defaultValue: "Utwórz konto" })}
        </button>
        <p className="text-sm text-slate-400">
          <Link to="/login" className="text-brand-blue">
            {t("auth.loginLink", { defaultValue: "Masz już konto? Zaloguj się" })}
          </Link>
        </p>
      </form>
    </div>
  );
}
