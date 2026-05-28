import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";
import {
  TERMINAL_BADGE,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_EMPTY_STATE,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_GRID,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
} from "../components/terminal/terminalStyles";
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
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>Mirror Trading</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>{t("mirror.subtitle")}</p>
        </header>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h2 className="mb-4 text-xl font-semibold text-terminal-cyan">
            {t("mirror.activeMirrors", { defaultValue: "Your active mirrors" })}
          </h2>
          {loading ? (
            <p className="text-sm text-terminal-textMuted">{t("common.loading")}</p>
          ) : activeFollowing.length === 0 ? (
            <p className={TERMINAL_EMPTY_STATE}>{t("common.noData")}</p>
          ) : (
            <ul className={`${TERMINAL_INTELLIGENCE_GRID} md:grid-cols-2`}>
              {activeFollowing.map((row) => (
                <li key={row.traderId} className={TERMINAL_INTELLIGENCE_CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-terminal-cyan/15 text-sm font-semibold text-terminal-cyan">
                        {traderInitials(row.traderId)}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-semibold text-terminal-text">{row.traderId}</p>
                        <p className="mt-1 text-xs text-terminal-textMuted">
                          {t("mirror.winRate")}: {row.winRate.toFixed(1)}% · {t("mirror.totalTrades")}:{" "}
                          {row.totalTrades}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-terminal-positive/35 bg-terminal-positive/10 px-2.5 py-1 text-xs font-semibold text-terminal-positive">
                      Active
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-terminal-text">
                      Returns:{" "}
                      <span className={readReturnsPct(row) >= 0 ? "text-terminal-positive" : "text-terminal-negative"}>
                        {formatSignedPct(readReturnsPct(row))}
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={actionTrader === row.traderId}
                      onClick={() => void onUnfollow(row.traderId)}
                      className="rounded-lg border border-terminal-negative/40 bg-terminal-negative/10 px-3 py-1.5 text-sm font-semibold text-terminal-negative transition hover:bg-terminal-negative/20 disabled:opacity-50"
                    >
                      {actionTrader === row.traderId ? t("common.loading") : "Stop mirror"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h2 className="mb-4 text-xl font-semibold text-terminal-cyan">
            {t("mirror.topTraders", { defaultValue: "Top traders" })}
          </h2>
          {loading ? (
            <p className="text-sm text-terminal-textMuted">{t("common.loading")}</p>
          ) : topTraders.length === 0 ? (
            <p className={TERMINAL_EMPTY_STATE}>{t("mirror.noTopTraders")}</p>
          ) : (
            <ul className={`${TERMINAL_INTELLIGENCE_GRID} md:grid-cols-2`}>
              {topTraders.map((tr) => {
                const isSelf = tr.userId === userId;
                const isFollowing = activeTraderIds.has(tr.userId);
                const busy = actionTrader === tr.userId;
                const returnsPct = readReturnsPct(tr);
                return (
                  <li key={tr.userId} className={TERMINAL_INTELLIGENCE_CARD}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-terminal-cyan/15 text-sm font-semibold text-terminal-cyan">
                          {traderInitials(tr.userId)}
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-terminal-text">{tr.userId}</p>
                          <p className="mt-1 text-xs text-terminal-textMuted">
                            {t("mirror.totalTrades")}: {tr.totalTrades} · {t("mirror.followers")}: {tr.followers}
                          </p>
                        </div>
                      </div>
                      <span className={TERMINAL_BADGE}>
                        {t("mirror.winRate")}: {tr.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-terminal-text">
                        Returns:{" "}
                        <span className={returnsPct >= 0 ? "text-terminal-positive" : "text-terminal-negative"}>
                          {formatSignedPct(returnsPct)}
                        </span>
                      </p>
                      {isSelf ? (
                        <span className={TERMINAL_BADGE}>{t("mirror.itsYou")}</span>
                      ) : isFollowing ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onUnfollow(tr.userId)}
                          className={TERMINAL_BUTTON_SECONDARY}
                        >
                          {busy ? t("common.loading") : "Mirroring"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onFollow(tr.userId)}
                          className={TERMINAL_BUTTON_PRIMARY}
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
