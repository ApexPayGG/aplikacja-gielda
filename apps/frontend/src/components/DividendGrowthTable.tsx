import type { DividendGrowthRow } from "../services/api";

interface Props {
  rows: DividendGrowthRow[];
  loading: boolean;
  error: string | null;
}

export function DividendGrowthTable({ rows, loading, error }: Props) {
  if (loading) {
    return <p className="text-sm text-slate-400">Ładowanie screenera…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Brak wyników dla podanych filtrów.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="min-w-full text-left text-sm text-slate-300">
        <thead className="bg-surface-elevated text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Rok</th>
            <th className="px-4 py-3">Dywidenda roczna</th>
            <th className="px-4 py-3">Wzrost YoY %</th>
            <th className="px-4 py-3">CAGR 5Y %</th>
            <th className="px-4 py-3">Yield %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-t border-surface-border hover:bg-white/5">
              <td className="px-4 py-3 font-mono font-medium text-accent">{r.symbol}</td>
              <td className="px-4 py-3">{r.latestYear}</td>
              <td className="px-4 py-3">{r.totalAmount.toFixed(2)}</td>
              <td className="px-4 py-3">{r.growthYoY != null ? r.growthYoY.toFixed(2) : "—"}</td>
              <td className="px-4 py-3">{r.cagr5Y != null ? r.cagr5Y.toFixed(2) : "—"}</td>
              <td className="px-4 py-3">{r.latestYield != null ? r.latestYield.toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
