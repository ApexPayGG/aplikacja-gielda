import { useState } from "react";
import { useTranslation } from "react-i18next";
import { findReverseScreenerSetups, type ReverseScreenerFindResponse } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatFollowUp(outcome5d: number, outcome10d: number): string {
  return `5D: ${formatPct(outcome5d)} | 10D: ${formatPct(outcome10d)}`;
}

export function ReverseScreenerPage() {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReverseScreenerFindResponse | null>(null);

  async function onFind() {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setError("Podaj ticker, aby rozpocząć wyszukiwanie.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await findReverseScreenerSetups({ symbol: normalizedSymbol });
      setResult(data);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Reverse Screener</h1>
          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Historyczne setupy podobne do dzisiejszego układu świec i wolumenu.
          </p>
          <p className="text-sm font-medium" style={{ color: colors.brandMedium }}>
            Które spółki historycznie wyglądały tak samo jak {symbol.trim().toUpperCase() || "ticker"} dziś?
          </p>
        </header>

        <section className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: colors.border }}>
          <label className="text-sm font-semibold" htmlFor="rs-symbol" style={{ color: colors.textSecondary }}>
            Search ticker input
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="rs-symbol"
              className="h-11 flex-1 rounded-xl border px-4 text-base outline-none transition-colors"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
              placeholder="np. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              autoCapitalize="characters"
            />
            <button
              type="button"
              className="h-11 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
              disabled={loading}
              onClick={() => void onFind()}
            >
              {loading ? t("common.loading") : "Szukaj podobnych"}
            </button>
          </div>
        </section>

        {error ? (
          <p className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: colors.negative, color: colors.negative }}>
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Wyniki</h2>
              <span className="text-sm" style={{ color: colors.textSecondary }}>
                Średni wynik: <strong style={{ color: colors.brandDark }}>{formatPct(result.avgOutcome)}</strong>
              </span>
            </div>

            {result.matches.length === 0 ? (
              <p className="rounded-xl border bg-white px-4 py-3 text-sm" style={{ borderColor: colors.border, color: colors.textSecondary }}>
                Brak dopasowań dla podanego tickera.
              </p>
            ) : (
              <ul className="space-y-3">
                {result.matches.map((match) => (
                  <li
                    key={`${match.symbol}-${match.date}`}
                    className="rounded-2xl border bg-white p-4 shadow-sm"
                    style={{ borderColor: colors.border }}
                  >
                    <div className="grid gap-3 text-sm md:grid-cols-[1fr_1fr_auto_2fr] md:items-center">
                      <div>
                        <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                          Ticker
                        </p>
                        <p className="text-lg font-bold" style={{ color: colors.brandDark }}>
                          {match.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                          Data
                        </p>
                        <p className="font-medium">{match.date}</p>
                      </div>
                      <div className="justify-self-start md:justify-self-center">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ backgroundColor: "rgba(0, 201, 212, 0.16)", color: colors.brandCyan }}
                        >
                          Similarity {match.similarity.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
                          Co się wydarzyło potem
                        </p>
                        <p className="font-medium" style={{ color: colors.textSecondary }}>
                          {formatFollowUp(match.outcome5d, match.outcome10d)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
