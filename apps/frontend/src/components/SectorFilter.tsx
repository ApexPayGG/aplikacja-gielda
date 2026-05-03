const SECTORS = [
  "All",
  "Technology",
  "Financial Services",
  "Healthcare",
  "Consumer Cyclical",
  "Industrials",
  "Energy",
  "Communication Services",
  "Consumer Defensive",
  "Utilities",
  "Real Estate",
  "Basic Materials",
] as const;

type Props = {
  value: string;
  onChange: (sector: string) => void;
};

export function SectorFilter({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="sector" className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Sector
      </label>
      <select
        id="sector"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[200px] rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {SECTORS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
