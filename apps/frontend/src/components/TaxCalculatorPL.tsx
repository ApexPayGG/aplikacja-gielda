import { useState } from "react";
import { calculateDividendTaxPL } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export function TaxCalculatorPL() {
  const [shares, setShares] = useState("100");
  const [price, setPrice] = useState("180");
  const [dps, setDps] = useState("1.0");
  const [yieldPct, setYieldPct] = useState("");
  const [result, setResult] = useState<{
    grossDividend: number;
    taxAmount: number;
    netIncome: number;
    taxRate: number;
    method: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: {
        shares: number;
        currentPrice: number;
        dividendPerShare?: number;
        annualDividendYieldPercent?: number;
      } = {
        shares: parseFloat(shares),
        currentPrice: parseFloat(price),
      };
      const d = parseFloat(dps);
      if (!Number.isNaN(d) && d >= 0) body.dividendPerShare = d;
      const y = parseFloat(yieldPct);
      if (yieldPct.trim() !== "" && !Number.isNaN(y) && y >= 0) {
        body.annualDividendYieldPercent = y;
        delete body.dividendPerShare;
      }
      const data = await calculateDividendTaxPL(body);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated/50 p-6">
      <h3 className="text-lg font-semibold text-white">Podatek od dywidend (PIT 19%)</h3>
      <p className="mt-1 text-sm text-slate-400">
        Szacunek brutto: <strong>akcje × dywidenda na akcję</strong> lub{" "}
        <strong>akcje × cena × (yield % / 100)</strong> — wypełnij yield tylko jeśli nie używasz DPS.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Liczba akcji</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Cena (referencyjna)</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Dywidenda roczna / akcję (USD)</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={dps}
            onChange={(e) => setDps(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Alternatywa: yield roczny % (opcjonalnie)</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={yieldPct}
            onChange={(e) => setYieldPct(e.target.value)}
            type="number"
            min={0}
            step="any"
            placeholder="np. 2.5"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Liczenie…" : "Oblicz"}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <dt className="text-slate-500">Metoda</dt>
          <dd className="text-slate-200">{result.method}</dd>
          <dt className="text-slate-500">Dywidenda brutto</dt>
          <dd className="font-mono text-white">{result.grossDividend.toFixed(2)}</dd>
          <dt className="text-slate-500">Podatek ({(result.taxRate * 100).toFixed(0)}%)</dt>
          <dd className="font-mono text-white">{result.taxAmount.toFixed(2)}</dd>
          <dt className="text-slate-500">Netto</dt>
          <dd className="font-mono text-accent">{result.netIncome.toFixed(2)}</dd>
        </dl>
      )}
    </div>
  );
}
