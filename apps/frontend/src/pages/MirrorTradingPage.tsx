import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
};

type FollowingRow = {
  traderId: string;
  winRate: number;
  totalTrades: number;
  active: boolean;
};

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
    <div className="min-h-screen bg-brand-bg px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white">{t("mirror.title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("mirror.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded-lg border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <section className="neo-panel rounded-xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">{t("mirror.myFollowing")}</h2>
          {loading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : activeFollowing.length === 0 ? (
            <p className="text-sm text-slate-500">{t("common.noData")}</p>
          ) : (
            <ul className="space-y-3">
              {activeFollowing.map((row) => (
                <li
                  key={row.traderId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/40 px-4 py-3"
                >
                  <div>
                    <div className="font-mono text-sm font-semibold text-white">{row.traderId}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {t("mirror.winRate")}: {row.winRate.toFixed(1)}% · {t("mirror.totalTrades")}:{" "}
                      {row.totalTrades}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={actionTrader === row.traderId}
                    onClick={() => void onUnfollow(row.traderId)}
                    className="rounded-lg border border-brand-red/50 bg-brand-red/10 px-3 py-1.5 text-sm text-brand-red transition hover:bg-brand-red/20 disabled:opacity-50"
                  >
                    {actionTrader === row.traderId ? t("common.loading") : t("mirror.unfollow")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="neo-panel rounded-xl p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">{t("mirror.topTraders")}</h2>
          {loading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : topTraders.length === 0 ? (
            <p className="text-sm text-slate-500">{t("mirror.noTopTraders")}</p>
          ) : (
            <ul className="space-y-3">
              {topTraders.map((tr) => {
                const isSelf = tr.userId === userId;
                const isFollowing = activeTraderIds.has(tr.userId);
                const busy = actionTrader === tr.userId;
                return (
                  <li
                    key={tr.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/40 px-4 py-3"
                  >
                    <div>
                      <div className="font-mono text-sm font-semibold text-white">{tr.userId}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {t("mirror.winRate")}: {tr.winRate.toFixed(1)}% · {t("mirror.totalTrades")}:{" "}
                        {tr.totalTrades} · {t("mirror.followers")}: {tr.followers}
                      </div>
                    </div>
                    {isSelf ? (
                      <span className="text-xs text-slate-500">{t("mirror.itsYou")}</span>
                    ) : isFollowing ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onUnfollow(tr.userId)}
                        className="rounded-lg border border-brand-red/50 bg-brand-red/10 px-3 py-1.5 text-sm text-brand-red transition hover:bg-brand-red/20 disabled:opacity-50"
                      >
                        {busy ? t("common.loading") : t("mirror.unfollow")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onFollow(tr.userId)}
                        className="rounded-lg border border-brand-green/50 bg-brand-green/10 px-3 py-1.5 text-sm text-brand-green transition hover:bg-brand-green/20 disabled:opacity-50"
                      >
                        {busy ? t("common.loading") : t("mirror.follow")}
                      </button>
                    )}
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
