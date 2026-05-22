import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { getBehavioralCooldown, type BehavioralCooldownResponse } from "../services/api";
import { colors } from "../styles/designSystem";
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

function statusStyle(status: "NORMAL" | "WARNING" | "COOLDOWN"): { bg: string; color: string } {
  if (status === "COOLDOWN") {
    return { bg: "rgba(229, 57, 53, 0.12)", color: colors.negative };
  }
  if (status === "WARNING") {
    return { bg: "rgba(255, 174, 51, 0.16)", color: colors.brandGold };
  }
  return { bg: "rgba(0, 168, 107, 0.12)", color: colors.positive };
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
  const statusBadge = statusStyle(status);

  const streakHistory = useMemo(() => {
    const seed = [1, 0, 2, 1, 3];
    return [...seed, currentStreak];
  }, [currentStreak]);

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Loss Streak Monitor</h1>
          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            {t("lossStreakPage.subtitle", {
              defaultValue:
                "Manage loss streaks and automatic cooldown so you do not escalate risk after emotional trades.",
            })}
          </p>
        </header>

        {error ? (
          <p className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: colors.negative, color: colors.negative }}>
            {error}
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl glass-section p-5 shadow-sm md:col-span-2" style={{ borderColor: colors.border }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              {t("lossStreakPage.currentStreak", { defaultValue: "Current streak" })}
            </p>
            <p
              className="mt-3 text-6xl font-bold leading-none"
              style={{ color: currentStreak > 2 ? colors.negative : colors.brandDark }}
            >
              {loading ? "…" : currentStreak}
            </p>
          </article>

          <article className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Status
            </p>
            <span
              className="mt-3 inline-flex rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}
            >
              {status}
            </span>
            {countdown ? (
              <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
                {t("lossStreakPage.cooldownIntro", { defaultValue: "Cooldown timer:" })}
                <span className="ml-2 font-mono text-lg font-bold" style={{ color: colors.brandDark }}>
                  {countdown}
                </span>
              </p>
            ) : null}
          </article>
        </section>

        <section className="rounded-2xl glass-section p-5 shadow-sm" style={{ borderColor: colors.border }}>
          <h2 className="text-base font-semibold">{t("lossStreakPage.streakHistory", { defaultValue: "Streak history" })}</h2>
          <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
            Mini chart placeholder
          </p>
          <div className="mt-4 grid grid-cols-6 items-end gap-2 rounded-xl border p-4" style={{ borderColor: colors.border }}>
            {streakHistory.map((value, idx) => (
              <div key={`streak-${idx}`} className="flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-md"
                  style={{
                    height: `${Math.max(12, value * 14)}px`,
                    backgroundColor: value > 2 ? colors.negative : "rgba(122, 15, 158, 0.35)",
                  }}
                />
                <span className="text-[10px]" style={{ color: colors.textMuted }}>
                  D{idx + 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            {t("lossStreakPage.cooldownHeading", { defaultValue: "Cool-down principles" })}
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {cooldownRules.map((rule) => (
              <article key={rule} className="rounded-xl glass-section p-4 shadow-sm" style={{ borderColor: colors.border }}>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {rule}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
