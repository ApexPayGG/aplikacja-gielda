import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  api,
  generateTrackRecord,
  getPublicTrackRecord,
  type TrackRecordPublicResponse,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

type PaperTradeHistoryItem = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  exitAt?: string;
  pnl?: number;
  pnlPct?: number;
};

type PaperHistoryResponse = {
  count: number;
  data: PaperTradeHistoryItem[];
};

type TradeHistoryRow = {
  id: string;
  symbol: string;
  direction: string;
  closedAt: string | null;
  pnlValue: number;
  pnlPct: number;
};

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function mapHistoryRows(payload: PaperHistoryResponse): TradeHistoryRow[] {
  return (payload.data ?? [])
    .filter((trade) => Number.isFinite(trade.pnlPct))
    .map((trade) => ({
      id: trade.id,
      symbol: trade.ticker,
      direction: trade.direction,
      closedAt: trade.exitAt ?? null,
      pnlValue: Number(trade.pnl ?? 0),
      pnlPct: Number(trade.pnlPct ?? 0),
    }))
    .sort((a, b) => {
      const aTs = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const bTs = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return bTs - aTs;
    });
}

function fallbackRows(metrics: TrackRecordPublicResponse): TradeHistoryRow[] {
  return [
    {
      id: "best",
      symbol: "Best trade",
      direction: "—",
      closedAt: metrics.generatedAt,
      pnlValue: 0,
      pnlPct: metrics.bestTradePct,
    },
    {
      id: "avg",
      symbol: "Average",
      direction: "—",
      closedAt: metrics.generatedAt,
      pnlValue: 0,
      pnlPct: metrics.avgReturn,
    },
    {
      id: "worst",
      symbol: "Worst trade",
      direction: "—",
      closedAt: metrics.generatedAt,
      pnlValue: 0,
      pnlPct: metrics.worstTradePct,
    },
  ];
}

export function TrackRecordPage() {
  const { t } = useTranslation();
  const { hash } = useParams<{ hash?: string }>();
  const isPublicView = Boolean(hash);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicHash, setPublicHash] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TrackRecordPublicResponse | null>(null);
  const [historyRows, setHistoryRows] = useState<TradeHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const effectiveHash = hash ?? publicHash;
  const shareUrl = effectiveHash ? `stock-ai.pro/track-record/public/${effectiveHash}` : null;
  const tableRows = useMemo(() => {
    if (historyRows.length > 0) return historyRows;
    if (metrics) return fallbackRows(metrics);
    return [];
  }, [historyRows, metrics]);

  const maxWinStreak = useMemo(() => {
    if (tableRows.length === 0) return 0;
    const orderedAsc = [...tableRows].sort((a, b) => {
      const aTs = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const bTs = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return aTs - bTs;
    });
    let current = 0;
    let best = 0;
    for (const row of orderedAsc) {
      if (row.pnlPct > 0) {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    }
    return best;
  }, [tableRows]);

  useEffect(() => {
    if (isPublicView || !USER_ID) return;
    let active = true;
    setHistoryLoading(true);
    void api
      .get<PaperHistoryResponse>(`/paper/history/${encodeURIComponent(USER_ID)}`)
      .then((res) => {
        if (!active) return;
        setHistoryRows(mapHistoryRows(res.data));
      })
      .catch(() => {
        if (!active) return;
        setHistoryRows([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isPublicView]);

  useEffect(() => {
    if (!hash) return;
    let active = true;
    setLoading(true);
    setError(null);
    setPublicHash(hash);
    void getPublicTrackRecord(hash)
      .then((data) => {
        if (!active) return;
        setMetrics(data);
      })
      .catch((e) => {
        if (!active) return;
        setMetrics(null);
        setError(apiErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hash]);

  async function onGenerate() {
    if (isPublicView) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const generated = await generateTrackRecord(USER_ID);
      const publicMetrics = await getPublicTrackRecord(generated.publicHash);
      setPublicHash(generated.publicHash);
      setMetrics(publicMetrics);
    } catch (e) {
      setPublicHash(null);
      setMetrics(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(t("trackrecord.copyFailed"));
    }
  }

  return (
    <div className="min-h-screen bg-bgSecondary text-textPrimary">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header
          className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_16px_36px_rgba(45,10,107,0.08)]"
          style={{ background: `linear-gradient(120deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
        >
          <h1 className="text-3xl font-bold text-brandDark">Track Record</h1>
          <p className="mt-1 text-sm text-textSecondary">{t("trackrecord.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded-xl border border-negative/25 bg-negative/10 p-3 text-sm text-negative">
            {error}
          </div>
        ) : null}

        {!isPublicView ? (
          <section className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-[0_12px_30px_rgba(45,10,107,0.08)]">
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(45,10,107,0.35)] transition hover:brightness-110 disabled:opacity-60"
              style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
            >
              {loading ? t("common.loading") : t("trackrecord.generateButton")}
            </button>
          </section>
        ) : null}

        {metrics && shareUrl ? (
          <section className="space-y-5">
            <article className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_30px_rgba(45,10,107,0.08)]">
              <h2 className="text-lg font-semibold text-brandDark">Publiczny profil</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Win rate" value={`${metrics.winRate.toFixed(2)}%`} />
                <StatCard label="Avg return" value={`${metrics.avgReturn.toFixed(2)}%`} />
                <StatCard label="Trades" value={String(metrics.totalTrades)} />
                <StatCard label="Streak" value={String(maxWinStreak)} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <p className="text-textSecondary">
                  {t("trackrecord.shareLinkLabel")}: <span className="font-mono text-textPrimary">{shareUrl}</span>
                </p>
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="rounded-xl px-4 py-2 font-semibold text-brandDark transition hover:brightness-95"
                  style={{ backgroundColor: colors.brandCyan }}
                >
                  {copied ? t("trackrecord.copied") : t("trackrecord.copyButton")}
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_30px_rgba(45,10,107,0.08)]">
              <h3 className="text-lg font-semibold text-brandDark">Historia transakcji</h3>
              {historyLoading ? (
                <p className="mt-3 text-sm text-textSecondary">{t("common.loading")}</p>
              ) : tableRows.length === 0 ? (
                <p className="mt-3 text-sm text-textMuted">{t("common.noData")}</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-textMuted">
                        <th className="px-2 py-2">Symbol</th>
                        <th className="px-2 py-2">Direction</th>
                        <th className="px-2 py-2">Closed at</th>
                        <th className="px-2 py-2 text-right">P&amp;L</th>
                        <th className="px-2 py-2 text-right">P&amp;L %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tableRows.map((row) => {
                        const positive = row.pnlPct >= 0;
                        return (
                          <tr key={row.id} className="text-textPrimary">
                            <td className="px-2 py-2 font-semibold text-brandDark">{row.symbol}</td>
                            <td className="px-2 py-2 text-textSecondary">{row.direction}</td>
                            <td className="px-2 py-2 text-textSecondary">{formatDate(row.closedAt)}</td>
                            <td className={`px-2 py-2 text-right font-semibold ${positive ? "text-positive" : "text-negative"}`}>
                              {row.pnlValue === 0 ? "—" : `${row.pnlValue >= 0 ? "+" : ""}${row.pnlValue.toFixed(2)}`}
                            </td>
                            <td className={`px-2 py-2 text-right font-semibold ${positive ? "text-positive" : "text-negative"}`}>
                              {formatSignedPct(row.pnlPct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bgSecondary px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-textMuted">{props.label}</p>
      <p className="mt-1 text-2xl font-bold text-brandDark">{props.value}</p>
    </div>
  );
}
