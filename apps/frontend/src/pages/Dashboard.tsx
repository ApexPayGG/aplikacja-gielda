import { ChartBarIcon, HomeIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

export function Dashboard() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-400">
        Overview hub for StockAI Pro. Use the company browser for live data from your API.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link
          to="/"
          className="flex items-start gap-4 rounded-2xl border border-surface-border bg-surface-elevated p-5 transition hover:border-accent/40"
        >
          <HomeIcon className="h-8 w-8 shrink-0 text-accent-muted" />
          <div>
            <h2 className="font-semibold text-white">Companies</h2>
            <p className="mt-1 text-sm text-slate-500">Search and sector grid with logos.</p>
          </div>
        </Link>

        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-surface-border bg-slate-900/30 p-5 opacity-80">
          <ChartBarIcon className="h-8 w-8 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-400">Signals</h2>
            <p className="mt-1 text-sm text-slate-600">Coming soon — screener & AI scores.</p>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-dashed border-surface-border bg-slate-900/30 p-5 opacity-80 sm:col-span-2">
          <Squares2X2Icon className="h-8 w-8 shrink-0 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-400">Portfolio</h2>
            <p className="mt-1 text-sm text-slate-600">Coming soon — watchlists and alerts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
