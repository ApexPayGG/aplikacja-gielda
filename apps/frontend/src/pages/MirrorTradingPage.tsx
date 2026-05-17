import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "../styles/designSystem";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function readUserId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("userId")?.trim() || "";
}

type TopTrader = {
  userId: string;
  winRate: number;
  totalTrades: number;
  followers: number;
  avgReturn?: number;
};

type FollowingRow = {
  traderId: string;
  winRate: number;
  totalTrades: number;
  active: boolean;
  avgReturn?: number;
};

function traderInitials(userId: string): string {
  const cleaned = userId.trim();
  if (!cleaned) return "TR";
  const chunks = cleaned
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] ?? ""}${chunks[1][0] ?? ""}`.toUpperCase();
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function readReturnsPct(entry: { avgReturn?: number; winRate: number }): number {
  if (typeof entry.avgReturn === "number" && Number.isFinite(entry.avgReturn)) {
    return entry.avgReturn;
  }
  return Number((entry.winRate - 50).toFixed(2));
}

export function MirrorTradingPage() {
  const { t } = useTranslation();
  const [userId] = useState(() => readUserId());
  const [topTraders, setTopTraders] = useState<TopTrader[]>([]);
  const [following, setFollowing] = useState<FollowingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTrader, setActionTrader] = useState<string | null>(null);

  const activeTraderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of following) {
      if (row.active) ids.add(row.traderId);
    }
    return ids;
  }, [following]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topRes, folRes] = await Promise.all([
        api.get<{ traders: TopTrader[] }>("/mirror/top-traders"),
        api.get<{ following: FollowingRow[] }>(`/mirror/following/${encodeURIComponent(userId)}`),
      ]);
      setTopTraders(topRes.data.traders ?? []);
      setFollowing(folRes.data.following ?? []);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFollow(traderId: string): Promise<void> {
    setActionTrader(traderId);
    setError(null);
    try {
      await api.post("/mirror/follow", { followerId: userId, traderId });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setActionTrader(null);
    }
  }

  async function onUnfollow(traderId: string): Promise<void> {
    setActionTrader(traderId);
    setError(null);
    try {
      await api.post("/mirror/unfollow", { followerId: userId, traderId });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setActionTrader(null);
    }
  }

  const activeFollowing = useMemo(() => following.filter((r) => r.active), [following]);

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-10 text-textPrimary">
      <div className="mx-auto max-w-6xl space-y-8">
        <header
          className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_18px_40px_rgba(45,10,107,0.1)]"
          style={{ background: `linear-gradient(120deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
        >
          <h1 className="text-3xl font-bold text-brandDark">Mirror Trading</h1>
          <p className="mt-2 text-sm text-textSecondary">{t("mirror.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded-xl border border-negative/25 bg-negative/10 px-4 py-3 text-sm text-negative">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
          <h2 className="mb-4 text-xl font-semibold text-brandDark">Twoje aktywne mirror</h2>
          {loading ? (
            <p className="text-sm text-textSecondary">{t("common.loading")}</p>
          ) : activeFollowing.length === 0 ? (
            <p className="text-sm text-textMuted">{t("common.noData")}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {activeFollowing.map((row) => (
                <li
                  key={row.traderId}
                  className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-[0_12px_26px_rgba(45,10,107,0.07)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                        style={{ backgroundColor: colors.brandDark }}
                      >
                        {traderInitials(row.traderId)}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-semibold text-brandDark">{row.traderId}</p>
                        <p className="mt-1 text-xs text-textSecondary">
                          {t("mirror.winRate")}: {row.winRate.toFixed(1)}% · {t("mirror.totalTrades")}:{" "}
                          {row.totalTrades}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-positive/35 bg-positive/10 px-2.5 py-1 text-xs font-semibold text-positive">
                      Active
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-textPrimary">
                      Returns:{" "}
                      <span className={readReturnsPct(row) >= 0 ? "text-positive" : "text-negative"}>
                        {formatSignedPct(readReturnsPct(row))}
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={actionTrader === row.traderId}
                      onClick={() => void onUnfollow(row.traderId)}
                      className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-1.5 text-sm font-semibold text-negative transition hover:bg-negative/20 disabled:opacity-50"
                    >
                      {actionTrader === row.traderId ? t("common.loading") : "Stop mirror"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
          <h2 className="mb-4 text-xl font-semibold text-brandDark">Top traderzy</h2>
          {loading ? (
            <p className="text-sm text-textSecondary">{t("common.loading")}</p>
          ) : topTraders.length === 0 ? (
            <p className="text-sm text-textMuted">{t("mirror.noTopTraders")}</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {topTraders.map((tr) => {
                const isSelf = tr.userId === userId;
                const isFollowing = activeTraderIds.has(tr.userId);
                const busy = actionTrader === tr.userId;
                const returnsPct = readReturnsPct(tr);
                return (
                  <li
                    key={tr.userId}
                    className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_26px_rgba(45,10,107,0.07)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: colors.brandDark }}
                        >
                          {traderInitials(tr.userId)}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-brandDark">{tr.userId}</p>
                          <p className="mt-1 text-xs text-textSecondary">
                            {t("mirror.totalTrades")}: {tr.totalTrades} · {t("mirror.followers")}: {tr.followers}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border border-brandDark/15 bg-brandDark/10 px-2.5 py-1 text-xs font-semibold text-brandDark">
                        {t("mirror.winRate")}: {tr.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-textPrimary">
                        Returns:{" "}
                        <span className={returnsPct >= 0 ? "text-positive" : "text-negative"}>
                          {formatSignedPct(returnsPct)}
                        </span>
                      </p>
                      {isSelf ? (
                        <span className="rounded-full border border-border bg-bgSecondary px-3 py-1 text-xs font-semibold text-textSecondary">
                          {t("mirror.itsYou")}
                        </span>
                      ) : isFollowing ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onUnfollow(tr.userId)}
                          className="rounded-lg border border-brandDark/20 bg-bgSecondary px-3 py-1.5 text-sm font-semibold text-brandDark transition hover:border-brandDark/35 disabled:opacity-50"
                        >
                          {busy ? t("common.loading") : "Mirroring"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onFollow(tr.userId)}
                          className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(45,10,107,0.35)] transition hover:brightness-110 disabled:opacity-55"
                          style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
                        >
                          {busy ? t("common.loading") : "Mirror"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
