import { FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getVolatilityHeatmap,
  type VolatilityHeatmapEntry,
  type VolatilityHeatmapResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

function toColor(value: number, min: number, max: number): string {
  if (!Number.isFinite(value)) return "rgba(71, 85, 105, 0.35)";
  if (max <= min) return "rgba(96, 165, 250, 0.55)";
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const red = Math.round(59 + (239 - 59) * ratio);
  const green = Math.round(130 + (68 - 130) * ratio);
  const blue = Math.round(246 + (68 - 246) * ratio);
  return `rgba(${red}, ${green}, ${blue}, 0.82)`;
}

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function VolatilityHeatMapPage() {
  const { t } = useTranslation();
  const [inputSymbol, setInputSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VolatilityHeatmapResponse | null>(null);

  const entriesByKey = useMemo(() => {
    const map = new Map<string, VolatilityHeatmapEntry>();
    for (const row of data?.heatmap ?? []) {
      map.set(`${row.year}-${row.month}`, row);
    }
    return map;
  }, [data]);

  const years = useMemo(() => {
    const unique = new Set<number>();
    for (const row of data?.heatmap ?? []) unique.add(row.year);
    return Array.from(unique).sort((a, b) => b - a);
  }, [data]);

  const volRange = useMemo(() => {
    const values = (data?.heatmap ?? []).map((row) => row.volatility).filter(Number.isFinite);
    if (values.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [data]);

  async function submit(symbolRaw: string) {
    const symbol = symbolRaw.trim().toUpperCase();
    if (!symbol) {
      setError(t("volatility.errors.symbolRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getVolatilityHeatmap(symbol);
      setData(result);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(inputSymbol);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">{t("volatility.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("volatility.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="neo-panel mb-6 flex flex-col gap-3 rounded-xl p-4 sm:flex-row">
        <input
          value={inputSymbol}
          onChange={(e) => setInputSymbol(e.target.value)}
          placeholder={t("volatility.searchPlaceholder")}
          className="w-full rounded-lg border border-brand-border/70 bg-slate-900/70 px-3 py-2 text-sm uppercase text-white outline-none transition focus:border-brand-blue sm:max-w-xs"
          maxLength={15}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
        >
          {loading ? t("common.loading") : t("volatility.searchAction")}
        </button>
      </form>

      {error ? (
        <div className="mb-4 rounded-lg border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
          {error}
        </div>
      ) : null}

      {!loading && data && (
        <section className="neo-panel rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full bg-slate-800/70 px-3 py-1">
              {t("volatility.symbol")}: <strong className="text-white">{data.symbol}</strong>
            </span>
            <span className="rounded-full bg-slate-800/70 px-3 py-1">
              {t("volatility.mostVolatileMonth")}: <strong className="text-white">{data.mostVolatileMonth}</strong>
            </span>
            <span className="rounded-full bg-slate-800/70 px-3 py-1">
              {t("volatility.leastVolatileMonth")}:{" "}
              <strong className="text-white">{data.leastVolatileMonth}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs uppercase tracking-wide text-slate-400">
                    {t("volatility.year")}
                  </th>
                  {MONTH_KEYS.map((monthKey) => (
                    <th key={monthKey} className="p-2 text-center text-xs uppercase tracking-wide text-slate-400">
                      {t(`volatility.months.${monthKey}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((year) => (
                  <tr key={year}>
                    <td className="p-2 font-semibold text-white">{year}</td>
                    {MONTH_KEYS.map((_, index) => {
                      const month = index + 1;
                      const entry = entriesByKey.get(`${year}-${month}`);
                      const cellColor = entry
                        ? toColor(entry.volatility, volRange.min, volRange.max)
                        : "rgba(51, 65, 85, 0.45)";
                      const tooltip = entry
                        ? `${t("volatility.tooltip.volatility")}: ${pct(entry.volatility)} | ${t("volatility.tooltip.avgReturn")}: ${pct(entry.avgReturn)}`
                        : t("volatility.noData");
                      return (
                        <td key={`${year}-${month}`} className="p-1">
                          <div
                            title={tooltip}
                            className="h-10 min-w-10 rounded-md border border-slate-700/50 transition hover:scale-[1.03]"
                            style={{ backgroundColor: cellColor }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{t("volatility.legendTitle")}</p>
            <div className="h-3 w-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>{t("volatility.legendLow")}</span>
              <span>{t("volatility.legendHigh")}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
