import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { getStrategyDna, type StrategyDnaResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

function legendLabel(name: StrategyDnaResponse["primary"]["name"], t: (key: string) => string): string {
  return t(`strategydna.legends.${name}`);
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

export function StrategyDnaPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<StrategyDnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromMistakes = searchParams.get("from") === "mistakes";
  const highlightSymbols = useMemo(() => {
    const one = searchParams.get("symbol")?.trim().toUpperCase();
    if (one) return [one];
    const raw = searchParams.get("symbols") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStrategyDna(USER_ID);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(apiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("strategydna.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("strategydna.subtitle")}</p>
      </header>

      {fromMistakes && highlightSymbols.length > 0 ? (
        <div className="mb-6 rounded-lg border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-slate-100">
          <p className="font-semibold text-brand-amber">{t("strategydna.fromMistakesTitle")}</p>
          <p className="mt-1 text-slate-200">{t("strategydna.fromMistakesBody", { symbols: highlightSymbols.join(", ") })}</p>
        </div>
      ) : null}

      {loading && <p className="text-slate-400">{t("common.loading")}</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && data && (
        <>
          {data.hasEnoughData ? (
            <section className="neo-panel rounded-2xl border border-brand-blue/30 p-8 text-center">
              <p className="text-sm uppercase tracking-wide text-slate-400">{t("strategydna.mainResultLabel")}</p>
              <p className="mt-3 text-5xl font-extrabold text-brand-blue">
                {pct(data.primary.pct)} {legendLabel(data.primary.name, t)}
              </p>
            </section>
          ) : (
            <section className="neo-panel rounded-2xl border border-brand-amber/35 p-6 text-center">
              <p className="text-lg font-semibold text-brand-amber">{t("strategydna.notEnoughData")}</p>
            </section>
          )}

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="neo-panel rounded-xl p-6 text-center">
              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border-4 border-brand-blue/70 bg-brand-bg text-3xl font-bold text-white">
                {pct(data.primary.pct)}
              </div>
              <p className="mt-4 text-sm text-slate-400">{t("strategydna.primary")}</p>
              <p className="text-xl font-semibold text-white">{legendLabel(data.primary.name, t)}</p>
            </div>

            <div className="neo-panel rounded-xl p-6 text-center">
              <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full border-4 border-brand-amber/70 bg-brand-bg text-3xl font-bold text-white">
                {pct(data.secondary.pct)}
              </div>
              <p className="mt-4 text-sm text-slate-400">{t("strategydna.secondary")}</p>
              <p className="text-xl font-semibold text-white">{legendLabel(data.secondary.name, t)}</p>
            </div>
          </section>

          <section className="neo-panel mt-8 rounded-xl p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t("strategydna.insightLabel")}</h2>
            <p className="mt-2 text-lg text-slate-100">{data.insight}</p>
          </section>
        </>
      )}
    </div>
  );
}
