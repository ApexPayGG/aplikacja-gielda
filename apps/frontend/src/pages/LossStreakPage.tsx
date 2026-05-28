import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getBehavioralCooldown, type BehavioralCooldownResponse } from "../services/api";
import {
  TERMINAL_DANGER_PANEL,
  TERMINAL_TOOL_CARD,
  TERMINAL_TOOL_GRID,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
  TERMINAL_WARNING_PANEL,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const FALLBACK_USER_ID = "mock-user";

function formatCountdown(unlocksAt: string, nowTs: number): string {
  const target = new Date(unlocksAt).getTime();
  if (!Number.isFinite(target)) return "00:00";
  const remainingMs = Math.max(0, target - nowTs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStatus(cooldown: BehavioralCooldownResponse | null): "NORMAL" | "WARNING" | "COOLDOWN" {
  if (cooldown?.active) return "COOLDOWN";
  if ((cooldown?.lossStreak ?? 0) > 2) return "WARNING";
  return "NORMAL";
}

function statusBadgeClass(status: "NORMAL" | "WARNING" | "COOLDOWN"): string {
  if (status === "COOLDOWN") return "border-terminal-negative/35 bg-terminal-negative/10 text-terminal-negative";
  if (status === "WARNING") return "border-amber-400/35 bg-amber-500/10 text-amber-200";
  return "border-terminal-positive/35 bg-terminal-positive/10 text-terminal-positive";
}

export function LossStreakPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? FALLBACK_USER_ID;
  const [cooldown, setCooldown] = useState<BehavioralCooldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const cooldownRules = useMemo(
    () => [
      t("lossStreakPage.rule1", {
        defaultValue: "After 3 consecutive losses the system activates a 30-minute cooldown.",
      }),
      t("lossStreakPage.rule2", {
        defaultValue: "During cooldown, do not open new positions — run through your risk checklist.",
      }),
      t("lossStreakPage.rule3", {
        defaultValue: "When cooldown ends, return only to setups from your daily plan.",
      }),
    ],
    [t],
  );

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (!cancelled) setLoading(true);
      try {
        const data = await getBehavioralCooldown(userId);
        if (cancelled) return;
        setCooldown(data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const poll = setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [userId]);

  const status = getStatus(cooldown);
  const currentStreak = cooldown?.lossStreak ?? 0;
  const countdown = cooldown?.active && cooldown.unlocksAt ? formatCountdown(cooldown.unlocksAt, nowTs) : null;
  const streakHistory = useMemo(() => {
    const seed = [1, 0, 2, 1, 3];
    return [...seed, currentStreak];
  }, [currentStreak]);

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={`${TERMINAL_TOOL_PAGE_INNER} max-w-5xl`}>
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">
            {t("lossStreakPage.eyebrow", { defaultValue: "Discipline monitor" })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-terminal-text md:text-4xl">Loss Streak Monitor</h1>
          <p className="text-sm text-terminal-textSecondary md:text-base">
            {t("lossStreakPage.subtitle", {
              defaultValue:
                "Manage loss streaks and automatic cooldown so you do not escalate risk after emotional trades.",
            })}
          </p>
        </header>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        <section className={TERMINAL_TOOL_GRID}>
          <article className={`${TERMINAL_TOOL_CARD} md:col-span-2`}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">
              {t("lossStreakPage.currentStreak", { defaultValue: "Current streak" })}
            </p>
            <p
              className={`mt-3 text-6xl font-bold leading-none ${
                currentStreak > 2 ? "text-terminal-negative" : "text-terminal-cyan"
              }`}
            >
              {loading ? "…" : currentStreak}
            </p>
          </article>

          <article className={TERMINAL_TOOL_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">Status</p>
            <span className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${statusBadgeClass(status)}`}>
              {status}
            </span>
            {countdown ? (
              <p className="mt-3 text-sm text-terminal-textSecondary">
                {t("lossStreakPage.cooldownIntro", { defaultValue: "Cooldown timer:" })}
                <span className="ml-2 font-mono text-lg font-bold text-terminal-cyan">{countdown}</span>
              </p>
            ) : null}
          </article>
        </section>

        <section className={TERMINAL_TOOL_PANEL}>
          <h2 className="text-base font-semibold text-terminal-text">{t("lossStreakPage.streakHistory", { defaultValue: "Streak history" })}</h2>
          <p className="mt-1 text-xs text-terminal-textMuted">Mini chart placeholder</p>
          <div className="mt-4 grid grid-cols-6 items-end gap-2 rounded-lg border border-terminal-borderMuted p-4">
            {streakHistory.map((value, idx) => (
              <div key={`streak-${idx}`} className="flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-md ${value > 2 ? "bg-terminal-negative/70" : "bg-terminal-cyan/40"}`}
                  style={{ height: `${Math.max(12, value * 14)}px` }}
                />
                <span className="text-[10px] text-terminal-textMuted">D{idx + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-terminal-text">
            {t("lossStreakPage.cooldownHeading", { defaultValue: "Cool-down principles" })}
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {cooldownRules.map((rule) => (
              <article key={rule} className={TERMINAL_TOOL_CARD}>
                <p className="text-sm text-terminal-textSecondary">{rule}</p>
              </article>
            ))}
          </div>
        </section>

        {status === "COOLDOWN" ? (
          <div className={TERMINAL_WARNING_PANEL}>
            {t("lossStreakPage.cooldownActive", { defaultValue: "Cooldown active — avoid opening new positions until the timer ends." })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
