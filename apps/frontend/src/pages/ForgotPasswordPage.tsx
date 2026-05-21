import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-bgPrimary p-8 shadow-[0_24px_72px_rgba(168,85,247,0.14)]">
        <h1 className="text-2xl font-bold text-textPrimary">Reset hasła</h1>
        <p className="mt-2 text-sm text-textSecondary">Podaj adres e-mail przypisany do konta.</p>

        {sent ? (
          <p className="mt-5 rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
            Sprawdź skrzynkę
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block space-y-1.5 text-sm text-textSecondary">
              <span>Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan"
              />
            </label>
            {error ? <p className="text-sm text-negative">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brandDark px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Wysyłanie..." : "Wyślij link resetujący"}
            </button>
          </form>
        )}

        <p className="mt-5 text-sm text-textSecondary">
          <Link to="/login" className="font-medium text-brandCyan">
            Powrót do logowania
          </Link>
        </p>
      </section>
    </div>
  );
}
