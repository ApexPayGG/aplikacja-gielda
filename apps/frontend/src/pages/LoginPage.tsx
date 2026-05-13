import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function LoginPage() {
  const navigate = useNavigate();
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
      navigate("/", { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="neo-panel w-full space-y-4 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white">Logowanie</h1>
        <label className="block space-y-1 text-sm text-slate-300">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
        <label className="block space-y-1 text-sm text-slate-300">
          <span>Haslo</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-brand-blue px-4 py-2 font-semibold text-brand-bg disabled:opacity-60"
        >
          {loading ? "Logowanie..." : "Zaloguj"}
        </button>
        <p className="text-sm text-slate-400">
          Nie masz konta?{" "}
          <Link to="/register" className="text-brand-blue">
            Zarejestruj sie
          </Link>
        </p>
      </form>
    </div>
  );
}
