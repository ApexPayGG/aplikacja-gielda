import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

const EXAMPLE_RULES = [
  "Max 2 transakcje dziennie",
  "Nie handluj w piątek po 14:00",
  "Stop loss zawsze przed wejściem",
];

type BiasSeverity = "positive" | "negative" | "brandGold";

const POSITIVE_BIAS_HINTS = ["discipline", "consistency", "patience", "plan", "calm", "focus"];
const NEGATIVE_BIAS_HINTS = ["revenge", "fomo", "panic", "over", "fear", "loss", "impulsive", "stress"];

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatDisplayName(userId: string): string {
  if (!userId) return "Trader";
  const base = userId.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Trader";
  return base
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "TR";
}

function getBiasSeverity(bias: string): BiasSeverity {
  const lower = bias.toLowerCase();
  if (POSITIVE_BIAS_HINTS.some((token) => lower.includes(token))) {
    return "positive";
  }
  if (NEGATIVE_BIAS_HINTS.some((token) => lower.includes(token))) {
    return "negative";
  }
  return "brandGold";
}

function growthScoreTheme(score: number): { color: string; bg: string } {
  if (score >= 70) {
    return {
      color: colors.positive,
      bg: withAlpha(colors.positive, 0.12),
    };
  }
  if (score >= 40) {
    return {
      color: colors.brandGold,
      bg: withAlpha(colors.brandGold, 0.16),
    };
  }
  return {
    color: colors.negative,
    bg: withAlpha(colors.negative, 0.12),
  };
}

function decisionTone(log: PsycheDecisionLog): string {
  if (log.planCompliance === true) return colors.positive;
  if (log.planCompliance === false) return colors.negative;
  if (typeof log.outcome === "number") return log.outcome >= 0 ? colors.positive : colors.negative;
  return colors.brandGold;
}

export function PsycheProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<TraderProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [rules, setRules] = useState<PsycheTradingRule[]>([]);
  const [logs, setLogs] = useState<PsycheDecisionLog[]>([]);
  const [newRule, setNewRule] = useState("");
  const [isRulesEditorOpen, setIsRulesEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exampleHint = useMemo(() => EXAMPLE_RULES.join(" · "), []);
  const displayName = useMemo(() => formatDisplayName(USER_ID), []);
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const scoreTheme = useMemo(() => growthScoreTheme(profile?.growthScore ?? 0), [profile?.growthScore]);
  const dominantTradingStyle = profile?.tradingStyle?.trim() || "Style pending";
  const detectedBiases = profile?.topBiases ?? [];
  const decisionTimeline = useMemo(() => logs.slice(0, 5), [logs]);
  const aiInsight = useMemo(() => {
    if (!profile) {
      return "AI insight pojawi się po pierwszym pełnym check-inie i analizie Twoich decyzji.";
    }
    const good = profile.goodConditions?.trim();
    const bad = profile.badConditions?.trim();
    if (good && bad) {
      return `Najlepiej działasz, gdy ${good}. Uważaj na sytuacje: ${bad}.`;
    }
    if (good) {
      return `Najbardziej stabilne decyzje podejmujesz, gdy ${good}.`;
    }
    if (bad) {
      return `Twoja główna strefa ryzyka: ${bad}. Wzmocnij pre-trade checklist przed wejściem.`;
    }
    return "Twój profil dojrzewa. Kontynuuj check-iny i journaling, aby AI zbudowało precyzyjniejsze wskazówki.";
  }, [profile]);

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
      setLogs(l.logs);
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

  function onStartCheckIn(): void {
    void onRefreshProfile();
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">Trader Psyche Profile</h1>
          <p className="mt-2 text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Twój profil psychologiczny i decyzje tradingowe w design systemie AMC Energy.
          </p>
        </header>

        {error ? (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{ borderColor: colors.negative, backgroundColor: withAlpha(colors.negative, 0.08), color: colors.negative }}
          >
            {error}
          </div>
        ) : null}

        <section
          className="rounded-2xl glass-section p-5 shadow-sm md:p-6"
          style={{ borderColor: colors.border, opacity: loading ? 0.7 : 1 }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: colors.brandDark }}
              >
                {initials}
              </div>
              <div>
                <p className="text-xl font-semibold">{displayName}</p>
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  {hasProfile && profile?.updatedAt ? `Updated ${new Date(profile.updatedAt).toLocaleString()}` : "Waiting for profile data"}
                </p>
              </div>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ color: scoreTheme.color, backgroundColor: scoreTheme.bg }}
            >
              <span>GrowthScore</span>
              <span className="text-base">{profile?.growthScore ?? 0}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Trading Style
            </h2>
            <div className="mt-4">
              <span
                className="inline-flex rounded-full px-4 py-2 text-base font-semibold"
                style={{ color: colors.brandDark, backgroundColor: withAlpha(colors.brandCyan, 0.2) }}
              >
                {dominantTradingStyle}
              </span>
            </div>
          </section>

          <section className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Detected Biases
            </h2>
            {detectedBiases.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                Brak wykrytych biasów.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {detectedBiases.map((bias) => {
                  const severity = getBiasSeverity(bias);
                  const severityColor = severity === "positive" ? colors.positive : severity === "negative" ? colors.negative : colors.brandGold;
                  return (
                    <li key={bias} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                      <span className="text-sm font-medium">{bias}</span>
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: severityColor, backgroundColor: withAlpha(severityColor, 0.16) }}
                      >
                        {severity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Trading Rules
            </h2>

            {rules.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                Nie masz jeszcze zdefiniowanych reguł.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rules.map((rule) => (
                  <li key={rule.id} className="rounded-xl border px-3 py-2" style={{ borderColor: colors.border }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{rule.rule}</p>
                        <p className="text-xs" style={{ color: colors.textMuted }}>
                          Breaches: {rule.breaches}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase" style={{ color: rule.active ? colors.brandDark : colors.textMuted }}>
                          {rule.active ? "active" : "inactive"}
                        </span>
                        <span
                          className="relative inline-block h-6 w-11 rounded-full"
                          style={{ backgroundColor: rule.active ? colors.brandDark : colors.borderStrong }}
                        >
                          <span
                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all"
                            style={{ left: rule.active ? "1.4rem" : "0.125rem" }}
                          />
                        </span>
                      </div>
                    </div>
                    {isRulesEditorOpen ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void onDeleteRule(rule.id)}
                          className="text-xs font-semibold"
                          style={{ color: colors.negative }}
                        >
                          Usuń
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {isRulesEditorOpen ? (
              <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: colors.border }}>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
                  placeholder={`Dodaj regułę (${exampleHint})`}
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void onAddRule()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  Dodaj regułę
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Decision History
            </h2>
            {decisionTimeline.length === 0 ? (
              <p className="mt-4 text-sm" style={{ color: colors.textSecondary }}>
                Brak historii decyzji.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {decisionTimeline.map((entry, index) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: decisionTone(entry) }} />
                      {index < decisionTimeline.length - 1 ? (
                        <span className="mt-1 h-full w-px" style={{ backgroundColor: colors.border }} />
                      ) : null}
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm font-medium">
                        {entry.action} {entry.symbol}
                      </p>
                      <p className="text-xs" style={{ color: colors.textSecondary }}>
                        Mood: {entry.mood ?? "n/a"} · {entry.planCompliance === true ? "Plan ok" : entry.planCompliance === false ? "Plan break" : "Plan unknown"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section
          className="rounded-2xl p-5 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${colors.brandDark}, ${colors.brandMedium})` }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">AI Insight</p>
          <p className="mt-3 text-base leading-7 md:text-lg">{aiInsight}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsRulesEditorOpen((prev) => !prev)}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: colors.brandDark }}
          >
            Edytuj zasady
          </button>
          <button
            type="button"
            onClick={onStartCheckIn}
            disabled={refreshing}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: colors.brandDark }}
          >
            {refreshing ? "Odświeżanie..." : "Nowy Check-In"}
          </button>
        </div>
      </div>
    </div>
  );
}
