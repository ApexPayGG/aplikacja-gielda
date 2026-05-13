import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  createPsycheRule,
  deletePsycheRule,
  getPsycheDecisionLogs,
  getPsycheProfile,
  getPsycheRules,
  refreshPsycheProfile,
  type PsycheDecisionLog,
  type PsycheTradingRule,
  type TraderProfile,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

const EXAMPLE_RULES = [
  "Max 2 transakcje dziennie",
  "Nie handluj w piątek po 14:00",
  "Stop loss zawsze przed wejściem",
];

function growthColor(score: number): string {
  if (score >= 60) return "text-brand-green";
  if (score >= 35) return "text-brand-amber";
  return "text-brand-red";
}

function gaugeStyle(score: number): CSSProperties {
  const pct = Math.min(100, Math.max(0, score));
  const hue = pct >= 60 ? "#00c87a" : pct >= 35 ? "#f59e0b" : "#ff4a4a";
  return {
    background: `conic-gradient(${hue} ${pct * 3.6}deg, rgba(30,41,59,0.9) 0deg)`,
  };
}

export function PsycheProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [rules, setRules] = useState<PsycheTradingRule[]>([]);
  const [logs, setLogs] = useState<PsycheDecisionLog[]>([]);
  const [newRule, setNewRule] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exampleHint = useMemo(() => EXAMPLE_RULES.join(" · "), []);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [p, r, l] = await Promise.all([
        getPsycheProfile(USER_ID),
        getPsycheRules(USER_ID),
        getPsycheDecisionLogs(USER_ID, 50),
      ]);
      setProfile(p.profile);
      setHasProfile(p.hasProfile);
      setRules(r.rules);
      setLogs(l.logs.slice(0, 10));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function onRefreshProfile(): Promise<void> {
    setRefreshing(true);
    setError(null);
    try {
      const { profile: next } = await refreshPsycheProfile(USER_ID);
      setProfile(next);
      setHasProfile(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  async function onAddRule(): Promise<void> {
    const text = newRule.trim();
    if (!text) return;
    setError(null);
    try {
      const { rule } = await createPsycheRule(USER_ID, text);
      setRules((prev) => [rule, ...prev]);
      setNewRule("");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  async function onDeleteRule(id: string): Promise<void> {
    setError(null);
    try {
      await deletePsycheRule(id, USER_ID);
      setRules((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-slate-100">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("psyche.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("psyche.subtitle")}</p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void onRefreshProfile()}
          className="rounded-lg border border-brand-green/50 bg-brand-green/15 px-4 py-2 text-sm font-semibold text-brand-green transition hover:bg-brand-green/25 disabled:opacity-60"
        >
          {refreshing ? t("common.loading") : t("psyche.refresh")}
        </button>
      </header>

      {error ? <div className="rounded-lg border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div> : null}

      <section className="neo-panel rounded-2xl p-6">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-brand-blue">{t("psyche.dnaTitle")}</h2>
        {loading ? (
          <p className="text-center text-slate-400">{t("common.loading")}</p>
        ) : !hasProfile || !profile ? (
          <div className="text-center text-slate-400">
            <p>{t("psyche.noProfile")}</p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-start">
            <div className="mx-auto flex flex-col items-center gap-3">
              <div className="flex h-44 w-44 items-center justify-center rounded-full p-1" style={gaugeStyle(profile.growthScore)}>
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#060d18]">
                  <span className={`text-4xl font-extrabold ${growthColor(profile.growthScore)}`}>{profile.growthScore}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{t("psyche.growthScore")}</span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-500">{new Date(profile.updatedAt).toLocaleString()}</p>
            </div>
            <div className="space-y-4">
              <p className="text-lg font-semibold text-white">{profile.tradingStyle ?? "—"}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t("psyche.tradingStyle")}</p>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t("psyche.topBiases")}</p>
                <div className="flex flex-wrap gap-2">
                  {(profile.topBiases.length ? profile.topBiases : ["—"]).map((b) => (
                    <span
                      key={b}
                      className="rounded-full border border-brand-red/40 bg-brand-red/15 px-3 py-1 text-xs font-semibold text-brand-red"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{t("psyche.goodConditions")}</p>
                  <p className="mt-2 text-sm text-slate-200">{profile.goodConditions ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-brand-red/30 bg-brand-red/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">{t("psyche.badConditions")}</p>
                  <p className="mt-2 text-sm text-slate-200">{profile.badConditions ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="neo-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">{t("psyche.rulesTitle")}</h2>
        <div className="mb-4 flex flex-col gap-2 md:flex-row">
          <input
            className="flex-1 rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-blue"
            placeholder={`${t("psyche.rulePlaceholder")} (${exampleHint})`}
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void onAddRule()}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85"
          >
            {t("psyche.addRule")}
          </button>
        </div>
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-brand-bg/60 px-3 py-2 text-sm"
            >
              <span className="text-slate-200">{r.rule}</span>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {t("psyche.breaches")}: {r.breaches}
                </span>
                <button
                  type="button"
                  onClick={() => void onDeleteRule(r.id)}
                  className="text-xs font-semibold text-brand-red hover:underline"
                >
                  {t("psyche.deleteRule")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="neo-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">{t("psyche.decisionLogTitle")}</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-3">{t("psyche.colDate")}</th>
                <th className="py-2 pr-3">{t("psyche.colSymbol")}</th>
                <th className="py-2 pr-3">{t("psyche.colAction")}</th>
                <th className="py-2 pr-3">{t("psyche.colMood")}</th>
                <th className="py-2">{t("psyche.colCompliance")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    {t("psyche.emptyLogs")}
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-b border-slate-900/80">
                    <td className="py-2 pr-3 text-slate-400">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3 font-mono text-white">{row.symbol}</td>
                    <td className="py-2 pr-3 text-slate-200">{row.action}</td>
                    <td className="py-2 pr-3 text-slate-300">{row.mood ?? "—"}</td>
                    <td className="py-2 text-slate-300">
                      {row.planCompliance === true
                        ? t("psyche.complianceYes")
                        : row.planCompliance === false
                          ? t("psyche.complianceNo")
                          : t("psyche.complianceUnknown")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
