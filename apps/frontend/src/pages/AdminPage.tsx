import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminAffiliateStats,
  getAdminStats,
  getAdminUsers,
  type AdminAffiliateStatsResponse,
  updateAdminUserTier,
  type AdminStatsResponse,
  type AdminTier,
  type AdminUserItem,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { resolveIntlLocale } from "../utils/formatters";

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

const DEFAULT_AFFILIATE_STATS: AdminAffiliateStatsResponse = {
  totalClicks: 0,
  clicksByBroker: {},
  clicksByLang: {},
  clicksByPage: {},
  clicksLast7Days: [],
  clicksLast30Days: 0,
};

type DashboardTab = "users" | "affiliate";

type BreakdownRow = {
  label: string;
  clicks: number;
  percentage: number;
};

function formatDate(dateInput: string, language?: string): string {
  const date = new Date(dateInput);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(resolveIntlLocale(language), {
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

function normalizeLabel(value: string): string {
  return value
    .trim()
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toBreakdownRows(source: Record<string, number>, total: number): BreakdownRow[] {
  return Object.entries(source)
    .map(([label, clicks]) => ({
      label: normalizeLabel(label),
      clicks,
      percentage: total > 0 ? (clicks / total) * 100 : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
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
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<DashboardTab>("users");
  const [stats, setStats] = useState<AdminStatsResponse>(DEFAULT_STATS);
  const [affiliateStats, setAffiliateStats] = useState<AdminAffiliateStatsResponse>(
    DEFAULT_AFFILIATE_STATS,
  );
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [affiliateLoading, setAffiliateLoading] = useState(true);
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
        const [statsResponse, usersResponse] = await Promise.all([getAdminStats(), getAdminUsers(page, limit)]);
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

  useEffect(() => {
    const loadAffiliateDashboard = async () => {
      setAffiliateLoading(true);
      setError(null);
      try {
        const response = await getAdminAffiliateStats();
        setAffiliateStats(response);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setAffiliateLoading(false);
      }
    };
    void loadAffiliateDashboard();
  }, []);

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
  const affiliateClicksLast7Days = useMemo(
    () => affiliateStats.clicksLast7Days.reduce((acc, day) => acc + day.count, 0),
    [affiliateStats.clicksLast7Days],
  );
  const pageRows = useMemo(
    () => toBreakdownRows(affiliateStats.clicksByPage, affiliateStats.totalClicks),
    [affiliateStats.clicksByPage, affiliateStats.totalClicks],
  );
  const brokerRows = useMemo(
    () => toBreakdownRows(affiliateStats.clicksByBroker, affiliateStats.totalClicks),
    [affiliateStats.clicksByBroker, affiliateStats.totalClicks],
  );
  const langRows = useMemo(
    () => toBreakdownRows(affiliateStats.clicksByLang, affiliateStats.totalClicks),
    [affiliateStats.clicksByLang, affiliateStats.totalClicks],
  );

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          {refreshing && activeTab === "users" ? (
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Refreshing...
            </span>
          ) : affiliateLoading && activeTab === "affiliate" ? (
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

        <div className="flex flex-wrap items-center gap-2">
          <TabButton
            isActive={activeTab === "users"}
            onClick={() => setActiveTab("users")}
            label="Users"
          />
          <TabButton
            isActive={activeTab === "affiliate"}
            onClick={() => setActiveTab("affiliate")}
            label="Affiliate"
          />
        </div>

        {activeTab === "users" ? (
          <>
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
                      <th className="px-4 py-3 text-left font-semibold">{t("admin.colActions", { defaultValue: "Actions" })}</th>
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
                          {t("admin.noUsers", { defaultValue: "No users." })}
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
                              {formatDate(user.createdAt, i18n.language)}
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
                    style={{
                      borderColor: colors.borderStrong,
                      color: colors.brandDark,
                      backgroundColor: colors.bgPrimary,
                    }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                    style={{
                      borderColor: colors.borderStrong,
                      color: colors.brandDark,
                      backgroundColor: colors.bgPrimary,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t("admin.totalClicks", { defaultValue: "Total clicks" })} value={affiliateStats.totalClicks} />
              <StatCard label={t("admin.last7Days", { defaultValue: "Last 7 days" })} value={affiliateClicksLast7Days} />
              <StatCard label={t("admin.conversions", { defaultValue: "Conversions" })} value="—" />
              <StatCard label="Revenue" value="—" />
            </div>

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                {t("admin.clicksChart7d", { defaultValue: "Clicks chart (last 7 days)" })}
              </h2>
              <div className="mt-3">
                <AffiliateLineChart data={affiliateStats.clicksLast7Days} />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              <BreakdownTable
                title="Top pages"
                firstColumnLabel="Page"
                rows={pageRows}
                emptyLabel={t("admin.noData", { defaultValue: "No data." })}
              />
              <BreakdownTable
                title="Per broker"
                firstColumnLabel="Broker"
                rows={brokerRows}
                emptyLabel={t("admin.noData", { defaultValue: "No data." })}
              />
              <BreakdownTable
                title={t("admin.perLanguage", { defaultValue: "Per language" })}
                firstColumnLabel="Lang"
                rows={langRows}
                emptyLabel={t("admin.noData", { defaultValue: "No data." })}
              />
            </div>

            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textSecondary }}
            >
              {t("admin.clicksLast30Days", {
                defaultValue: "Clicks in the last 30 days:",
              })}{" "}
              <strong style={{ color: colors.textPrimary }}>{affiliateStats.clicksLast30Days}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-4 py-2 text-sm font-semibold transition"
      style={
        isActive
          ? {
              borderColor: colors.brandDark,
              color: colors.bgPrimary,
              background: `linear-gradient(130deg, ${colors.brandDark}, ${colors.brandMedium})`,
            }
          : {
              borderColor: colors.borderStrong,
              color: colors.brandDark,
              backgroundColor: colors.bgPrimary,
            }
      }
    >
      {label}
    </button>
  );
}

function AffiliateLineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const width = 720;
  const height = 220;
  const padding = 24;
  const safeData = data.length > 0 ? data : [{ date: "—", count: 0 }];
  const maxValue = Math.max(1, ...safeData.map((point) => point.count));
  const stepX = safeData.length > 1 ? (width - padding * 2) / (safeData.length - 1) : 0;
  const points = safeData
    .map((point, index) => {
      const x = padding + stepX * index;
      const ratio = point.count / maxValue;
      const y = height - padding - ratio * (height - padding * 2);
      return { x, y, label: point.date.slice(5), value: point.count };
    });

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Affiliate clicks last 7 days chart">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />
        <polyline
          fill="none"
          stroke={colors.brandCyan}
          strokeWidth={3}
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {points.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={4} fill={colors.brandCyan} />
        ))}
        {points.map((point) => (
          <text
            key={`${point.label}-${point.x}`}
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            fontSize={10}
            fill={colors.textSecondary}
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function BreakdownTable({
  title,
  firstColumnLabel,
  rows,
  emptyLabel,
}: {
  title: string;
  firstColumnLabel: string;
  rows: BreakdownRow[];
  emptyLabel: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
    >
      <header className="border-b px-4 py-3" style={{ borderColor: colors.border, backgroundColor: colors.bgTertiary }}>
        <h3 className="text-sm font-semibold">{title}</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr style={{ color: colors.textSecondary }}>
              <th className="px-4 py-3 text-left font-semibold">{firstColumnLabel}</th>
              <th className="px-4 py-3 text-right font-semibold">Clicks</th>
              <th className="px-4 py-3 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-sm" colSpan={3} style={{ color: colors.textSecondary }}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.label} className="border-t" style={{ borderColor: colors.border }}>
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-right">{row.clicks}</td>
                  <td className="px-4 py-3 text-right" style={{ color: colors.textSecondary }}>
                    {formatPercent(row.percentage)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
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
