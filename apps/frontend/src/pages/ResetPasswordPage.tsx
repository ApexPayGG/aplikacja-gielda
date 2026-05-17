import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get("token") ?? "").trim(), [params]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("Brak tokenu resetu hasła.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Hasło musi mieć minimum 8 znaków.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Hasła muszą być identyczne.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgSecondary px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-bgPrimary p-8 shadow-[0_24px_72px_rgba(45,10,107,0.14)]">
        <h1 className="text-2xl font-bold text-textPrimary">Ustaw nowe hasło</h1>
        <p className="mt-2 text-sm text-textSecondary">Wprowadź nowe hasło do konta.</p>

        {done ? (
          <p className="mt-5 rounded-xl border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
            Hasło zostało zmienione. Możesz się zalogować.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <label className="block space-y-1.5 text-sm text-textSecondary">
              <span>Nowe hasło</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan"
              />
            </label>
            <label className="block space-y-1.5 text-sm text-textSecondary">
              <span>Potwierdź hasło</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2.5 text-textPrimary outline-none transition focus:border-brandCyan"
              />
            </label>
            {error ? <p className="text-sm text-negative">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brandDark px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Zapisywanie..." : "Ustaw nowe hasło"}
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
