import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
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
        <h1 className="text-2xl font-bold text-white">Rejestracja</h1>
        <label className="block space-y-1 text-sm text-slate-300">
          <span>Imie (opcjonalnie)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white"
          />
        </label>
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
          <span>Haslo (min. 8 znakow)</span>
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
          {loading ? "Rejestracja..." : "Utworz konto"}
        </button>
        <p className="text-sm text-slate-400">
          Masz juz konto?{" "}
          <Link to="/login" className="text-brand-blue">
            Zaloguj sie
          </Link>
        </p>
      </form>
    </div>
  );
}
