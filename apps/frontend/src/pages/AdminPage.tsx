import { useEffect, useMemo, useState } from "react";
import {
  getAdminStats,
  getAdminUsers,
  updateAdminUserTier,
  type AdminStatsResponse,
  type AdminTier,
  type AdminUserItem,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const DEFAULT_STATS: AdminStatsResponse = {
  totalUsers: 0,
  freeUsers: 0,
  proUsers: 0,
  proPlusUsers: 0,
  newUsersToday: 0,
  newUsersThisWeek: 0,
  totalSignals: 0,
  totalTrades: 0,
  affiliateClicks: 0,
  affiliateConversions: 0,
};

function formatDate(dateInput: string): string {
  const date = new Date(dateInput);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeTier(tier: string): AdminTier {
  const normalized = tier.trim().toUpperCase();
  if (normalized === "PRO_PLUS" || normalized === "PRO+") return "PRO_PLUS";
  if (normalized === "PRO") return "PRO";
  return "FREE";
}

function getTierAction(tier: AdminTier): { label: string; nextTier: AdminTier } {
  if (tier === "FREE") return { label: "Upgrade", nextTier: "PRO" };
  if (tier === "PRO") return { label: "Upgrade", nextTier: "PRO_PLUS" };
  return { label: "Downgrade", nextTier: "PRO" };
}

function TierBadge({ tier }: { tier: string }) {
  const normalizedTier = normalizeTier(tier);
  if (normalizedTier === "FREE") {
    return (
      <span
        className="inline-flex rounded-full border px-2 py-1 text-xs font-semibold"
        style={{ color: colors.textMuted, borderColor: `${colors.textMuted}66`, backgroundColor: colors.bgSecondary }}
      >
        FREE
      </span>
    );
  }
  if (normalizedTier === "PRO") {
    return (
      <span
        className="inline-flex rounded-full px-2 py-1 text-xs font-semibold text-white"
        style={{ backgroundColor: colors.brandDark }}
      >
        PRO
      </span>
    );
  }
  return (
    <span
      className="inline-flex rounded-full px-2 py-1 text-xs font-semibold text-white"
      style={{ background: `linear-gradient(130deg, ${colors.brandDark}, ${colors.brandMedium})` }}
    >
      PRO+
    </span>
  );
}

export function AdminPage() {
  const [stats, setStats] = useState<AdminStatsResponse>(DEFAULT_STATS);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalUsersCount / limit)),
    [limit, totalUsersCount],
  );

  useEffect(() => {
    const isInitialLoad = page === 1 && users.length === 0;
    const loadDashboard = async () => {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [statsResponse, usersResponse] = await Promise.all([
          getAdminStats(),
          getAdminUsers(page, limit),
        ]);
        setStats(statsResponse);
        setUsers(usersResponse.users ?? []);
        setTotalUsersCount(usersResponse.total ?? 0);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, page]);

  const handleTierChange = async (user: AdminUserItem) => {
    const tier = normalizeTier(user.tier);
    const action = getTierAction(tier);
    setUpdatingUserId(user.id);
    setError(null);
    try {
      const response = await updateAdminUserTier(user.id, action.nextTier);
      setUsers((prev) =>
        prev.map((row) => (row.id === user.id ? { ...row, tier: response.user.tier } : row)),
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const proUsersTotal = stats.proUsers + stats.proPlusUsers;

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          {refreshing ? (
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Refreshing...
            </span>
          ) : null}
        </div>

        {error ? (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: `${colors.negative}66`, backgroundColor: `${colors.negative}14`, color: colors.negative }}
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Pro Users" value={proUsersTotal} />
          <StatCard label="Signals Today" value={stats.totalSignals} />
          <StatCard label="Revenue" value="—" />
        </div>

        <section
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead style={{ backgroundColor: colors.bgTertiary }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-left font-semibold">Joined</th>
                  <th className="px-4 py-3 text-left font-semibold">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center"
                      style={{ color: colors.textSecondary }}
                    >
                      Loading admin users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center"
                      style={{ color: colors.textSecondary }}
                    >
                      Brak użytkowników.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const action = getTierAction(normalizeTier(user.tier));
                    const isUpdating = updatingUserId === user.id;
                    return (
                      <tr key={user.id} className="border-t" style={{ borderColor: colors.border }}>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <TierBadge tier={user.tier} />
                        </td>
                        <td className="px-4 py-3" style={{ color: colors.textSecondary }}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleTierChange(user)}
                            disabled={isUpdating}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
                            style={{
                              background:
                                action.label === "Downgrade"
                                  ? colors.neutral
                                  : `linear-gradient(130deg, ${colors.brandDark}, ${colors.brandMedium})`,
                            }}
                          >
                            {isUpdating ? "Updating..." : action.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}
          >
            <span className="text-xs" style={{ color: colors.textSecondary }}>
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                style={{ borderColor: colors.borderStrong, color: colors.brandDark, backgroundColor: colors.bgPrimary }}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                style={{ borderColor: colors.borderStrong, color: colors.brandDark, backgroundColor: colors.bgPrimary }}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article
      className="rounded-2xl border p-4 shadow-sm"
      style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: colors.brandDark }}>
        {value}
      </p>
    </article>
  );
}
