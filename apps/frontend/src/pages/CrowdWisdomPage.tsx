import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCrowdWisdom, type CrowdWisdomResponse, type CrowdWisdomSignal } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function gaugeStyle(percent: number): string {
  const p = clampPercent(percent);
  return `conic-gradient(#22c55e ${p}%, #334155 ${p}% 100%)`;
}

function signalClass(signal: CrowdWisdomSignal): string {
  if (signal === "CONTRARIAN_BUY") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
  if (signal === "CONTRARIAN_SELL") return "bg-red-500/20 text-red-300 border-red-500/50";
  return "bg-slate-500/20 text-slate-200 border-slate-500/50";
}

export function CrowdWisdomPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("PKN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CrowdWisdomResponse | null>(null);

  const signalLabel = useMemo(() => {
    if (!data) return "";
    if (data.signal === "CONTRARIAN_BUY") return t("crowdwisdom.signalBuy");
    if (data.signal === "CONTRARIAN_SELL") return t("crowdwisdom.signalSell");
    return t("crowdwisdom.signalNeutral");
  }, [data, t]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getCrowdWisdom(symbol);
      setData(response);
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white">{t("crowdwisdom.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("crowdwisdom.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="neo-panel rounded-xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-slate-400">{t("crowdwisdom.symbol")}</span>
            <input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              placeholder="PKN / AAPL"
              className="w-full rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("crowdwisdom.analyze")}
          </button>
        </div>
      </form>

      {error ? (
        <div className="mt-4 rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{error}</div>
      ) : null}

      {data ? (
        <section className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <GaugeCard title={t("crowdwisdom.retailSentiment")} value={data.retailBullish} />
            <GaugeCard title={t("crowdwisdom.insiderActivity")} value={data.insiderBuying} />
          </div>

          <div className="neo-panel rounded-xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">
                {data.symbol} · {t("crowdwisdom.result")}
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${signalClass(data.signal)}`}>
                {signalLabel}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              {t("crowdwisdom.divergence")}:{" "}
              <span className="font-semibold text-white">
                {data.divergence >= 0 ? "+" : ""}
                {data.divergence.toFixed(2)}%
              </span>
            </p>
            <p className="mt-3 rounded border border-brand-border bg-brand-bg/60 p-3 text-base text-slate-100">
              {data.insight}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GaugeCard(props: { title: string; value: number }) {
  const value = clampPercent(props.value);
  return (
    <div className="neo-panel rounded-xl p-5">
      <h3 className="mb-4 text-lg font-semibold text-white">{props.title}</h3>
      <div className="mx-auto grid h-52 w-52 place-items-center rounded-full p-3" style={{ background: gaugeStyle(value) }}>
        <div className="grid h-full w-full place-items-center rounded-full bg-brand-bg text-center">
          <div>
            <p className="text-4xl font-bold text-white">{value.toFixed(1)}%</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">score</p>
          </div>
        </div>
      </div>
    </div>
  );
}
