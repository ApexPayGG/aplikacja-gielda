import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "../styles/designSystem";
import { getCrowdWisdom, searchCompanies, type Company, type CrowdWisdomResponse } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function sentimentSummary(value: number): { percent: number; label: "kupuje" | "sprzedaje"; tone: "positive" | "negative" } {
  const clamped = clampPercent(value);
  if (clamped >= 50) {
    return { percent: clamped, label: "kupuje", tone: "positive" };
  }
  return { percent: 100 - clamped, label: "sprzedaje", tone: "negative" };
}

function formatPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`;
}

function formatDivergence(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} pp`;
}

const DIVERGENCE_GOLD_THRESHOLD = 15;

export function CrowdWisdomPage() {
  const { t } = useTranslation();
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CrowdWisdomResponse | null>(null);
  const [scannedCompanies, setScannedCompanies] = useState<CrowdWisdomResponse[]>([]);
  const searchRequestId = useRef(0);

  useEffect(() => {
    const query = symbolInput.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const requestId = searchRequestId.current + 1;
      searchRequestId.current = requestId;
      setSearching(true);
      try {
        const response = await searchCompanies(query, 8);
        if (searchRequestId.current !== requestId) return;
        setSuggestions(response);
      } catch {
        if (searchRequestId.current !== requestId) return;
        setSuggestions([]);
      } finally {
        if (searchRequestId.current !== requestId) return;
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [symbolInput]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const response = await getCrowdWisdom(symbol);
      setSelectedCompany(response);
      setScannedCompanies((previous) => {
        const next = previous.filter((item) => item.symbol !== response.symbol);
        return [...next, response];
      });
    } catch (e) {
      setSelectedCompany(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const divergenceLeaders = useMemo(
    () =>
      [...scannedCompanies]
        .sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
        .slice(0, 10),
    [scannedCompanies],
  );

  const retailSentiment = selectedCompany ? sentimentSummary(selectedCompany.retailBullish) : null;
  const insiderSentiment = selectedCompany ? sentimentSummary(selectedCompany.insiderBuying) : null;
  const divergenceValue = selectedCompany ? Math.abs(selectedCompany.divergence) : 0;
  const hasLargeDivergence = divergenceValue >= DIVERGENCE_GOLD_THRESHOLD;
  const signalLabel = selectedCompany
    ? selectedCompany.signal === "CONTRARIAN_BUY"
      ? t("crowdwisdom.signalBuy", { defaultValue: "Sygnał: Kupuj kontrariańsko" })
      : selectedCompany.signal === "CONTRARIAN_SELL"
        ? t("crowdwisdom.signalSell", { defaultValue: "Sygnał: Sprzedaj kontrariańsko" })
        : t("crowdwisdom.signalNeutral", { defaultValue: "Sygnał: Neutralny" })
    : "";
  const signalColor =
    selectedCompany?.signal === "CONTRARIAN_BUY"
      ? colors.positive
      : selectedCompany?.signal === "CONTRARIAN_SELL"
        ? colors.negative
        : colors.textSecondary;

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: colors.bgSecondary }}>
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-6">
          <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
            {t("crowdwisdom.redesignTitle", { defaultValue: "Crowd Wisdom Inverter" })}
          </h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {t("crowdwisdom.redesignSubtitle", {
              defaultValue:
                "Konfrontuj nastroje inwestorów retail z aktywnością insiderów i wychwytuj największe rozbieżności.",
            })}
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="relative rounded-2xl border p-4 md:p-5"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="relative flex-1 text-sm">
              <span className="mb-2 block font-semibold" style={{ color: colors.textSecondary }}>
                {t("crowdwisdom.searchStocks", { defaultValue: "Search spółki" })}
              </span>
              <input
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsInputFocused(false), 120);
                }}
                placeholder={t("crowdwisdom.searchPlaceholder", { defaultValue: "AAPL / PKN / MSFT" })}
                className="w-full rounded-xl border px-3 py-2.5 outline-none transition-colors"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                }}
              />
              {suggestions.length > 0 && isInputFocused ? (
                <ul
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border shadow-lg"
                  style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
                >
                  {suggestions.map((company) => (
                    <li key={`${company.symbol}-${company.name}`}>
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:opacity-90"
                        style={{ color: colors.textPrimary }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSymbolInput(company.symbol);
                          setSuggestions([]);
                          setIsInputFocused(false);
                        }}
                      >
                        <span className="font-semibold">{company.symbol}</span>
                        <span className="truncate" style={{ color: colors.textSecondary }}>
                          {company.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
            >
              {loading ? t("common.loading", { defaultValue: "Ładowanie..." }) : t("crowdwisdom.analyze", { defaultValue: "Analizuj" })}
            </button>
          </div>
          {searching ? (
            <p className="mt-2 text-xs" style={{ color: colors.textMuted }}>
              {t("crowdwisdom.searching", { defaultValue: "Wyszukiwanie spółek..." })}
            </p>
          ) : null}
        </form>

        {error ? (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: `${colors.negative}66`,
              color: colors.negative,
              backgroundColor: `${colors.negative}12`,
            }}
          >
            {error}
          </div>
        ) : null}

        {selectedCompany && retailSentiment && insiderSentiment ? (
          <section
            className="mt-6 rounded-2xl border p-5 md:p-6"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold" style={{ color: colors.brandDark }}>
                {selectedCompany.symbol}
              </h2>
              <span
                className="rounded-full px-4 py-1.5 text-sm font-bold"
                style={{
                  backgroundColor: hasLargeDivergence ? colors.brandGold : `${colors.brandMedium}22`,
                  color: hasLargeDivergence ? colors.brandDark : colors.brandMedium,
                }}
              >
                Divergence score: {formatDivergence(selectedCompany.divergence)}
              </span>
            </div>

            <span
              className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${signalColor}1A`, color: signalColor }}
            >
              {signalLabel}
            </span>

            <div className="grid gap-4 md:grid-cols-3">
              <SentimentCard title="Retail sentiment" sentiment={retailSentiment} />
              <SentimentCard title="Insider sentiment" sentiment={insiderSentiment} />

              <article className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
                <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  Divergence
                </p>
                <p className="mt-3 text-4xl font-bold" style={{ color: hasLargeDivergence ? colors.brandGold : colors.brandDark }}>
                  {formatDivergence(selectedCompany.divergence)}
                </p>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {hasLargeDivergence ? "Duża rozbieżność sentymentu." : "Rozbieżność w normie."}
                </p>
              </article>
            </div>

            <p className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
              {selectedCompany.insight}
            </p>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border p-5 md:p-6" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
            {t("crowdwisdom.topDivergence", { defaultValue: "Spółki z największą dywergencją" })}
          </h3>

          {divergenceLeaders.length === 0 ? (
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              {t("crowdwisdom.emptyLeaders", { defaultValue: "Brak danych. Wyszukaj i przeanalizuj pierwszą spółkę." })}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: colors.border }}>
              <table className="min-w-full text-left text-sm">
                <thead style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ticker</th>
                    <th className="px-4 py-3 font-semibold">Retail %</th>
                    <th className="px-4 py-3 font-semibold">Insider %</th>
                    <th className="px-4 py-3 font-semibold">Divergence</th>
                  </tr>
                </thead>
                <tbody>
                  {divergenceLeaders.map((row) => {
                    const highlight = Math.abs(row.divergence) >= DIVERGENCE_GOLD_THRESHOLD;
                    return (
                      <tr
                        key={row.symbol}
                        className="border-t"
                        style={{ borderColor: colors.border }}
                      >
                        <td className="px-4 py-3 font-semibold" style={{ color: colors.brandDark }}>
                          {row.symbol}
                        </td>
                        <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                          {formatPercent(row.retailBullish)}
                        </td>
                        <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                          {formatPercent(row.insiderBuying)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: highlight ? `${colors.brandGold}33` : colors.bgTertiary,
                              color: highlight ? colors.brandDark : colors.textSecondary,
                            }}
                          >
                            {formatDivergence(row.divergence)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SentimentCard(props: {
  title: string;
  sentiment: { percent: number; label: "kupuje" | "sprzedaje"; tone: "positive" | "negative" };
}) {
  const toneColor = props.sentiment.tone === "positive" ? colors.positive : colors.negative;
  return (
    <article className="rounded-xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
        {props.title}
      </p>
      <p className="mt-3 text-5xl font-bold leading-none" style={{ color: toneColor }}>
        {props.sentiment.percent.toFixed(1)}%
      </p>
      <span
        className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
        style={{ backgroundColor: `${toneColor}1A`, color: toneColor }}
      >
        {props.sentiment.label}
      </span>
    </article>
  );
}
