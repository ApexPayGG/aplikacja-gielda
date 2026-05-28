import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TerminalButton } from "./terminal";
import { useAuth } from "../context/AuthContext";
import {
  createDailyCheckIn,
  getDailyCheckInToday,
  type DailyCheckIn,
  type DailyCheckInRiskLevel,
} from "../services/api";

const USER_ID_FALLBACK = "";
const MOOD_VALUES = [1, 2, 3, 4, 5] as const;
const RISK_LEVELS: DailyCheckInRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

const MOOD_LABEL_DEFAULTS: Record<(typeof MOOD_VALUES)[number], { full: string; compact: string }> = {
  1: { full: "Stressed", compact: "Stress" },
  2: { full: "Cautious", compact: "Caution" },
  3: { full: "Neutral", compact: "Neutral" },
  4: { full: "Focused", compact: "Focus" },
  5: { full: "Confident", compact: "Confident" },
};

export type DailyCheckInWidgetState = {
  hasCheckedIn: boolean;
  riskLevel: DailyCheckInRiskLevel | null;
  aiMessage: string | null;
  mood: number | null;
};

type DailyCheckInWidgetProps = {
  compact?: boolean;
  appearance?: "light" | "glass" | "terminal";
  onStateChange?: (state: DailyCheckInWidgetState) => void;
};

function readUserId(): string {
  if (typeof window === "undefined") return USER_ID_FALLBACK;
  const value = window.localStorage.getItem("userId")?.trim();
  return value || USER_ID_FALLBACK;
}

function clampMood(value: number): (typeof MOOD_VALUES)[number] {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return clamped as (typeof MOOD_VALUES)[number];
}

function moodLabel(
  t: (key: string, opts?: { defaultValue?: string }) => string,
  value: number,
  compact: boolean,
): string {
  const mood = clampMood(value);
  const defaults = MOOD_LABEL_DEFAULTS[mood];
  const labelKey = compact ? "compact" : "full";
  return t(`checkin.mindset.${mood}.${labelKey}`, {
    defaultValue: defaults[labelKey],
  });
}

function publishState(
  onStateChange: DailyCheckInWidgetProps["onStateChange"],
  state: DailyCheckInWidgetState,
): void {
  onStateChange?.(state);
}

export function DailyCheckInWidget({
  compact = false,
  appearance = "terminal",
  onStateChange,
}: DailyCheckInWidgetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = useMemo(() => user?.id ?? readUserId(), [user?.id]);
  /** Terminal cockpit; `glass` is a deprecated alias. */
  const isTerminal = appearance === "terminal" || appearance === "glass";

  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mood, setMood] = useState<number>(3);
  const [plan, setPlan] = useState("");
  const [riskLevel, setRiskLevel] = useState<DailyCheckInRiskLevel>("MEDIUM");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function hydrate(): Promise<void> {
      try {
        const result = await getDailyCheckInToday(userId);
        if (!active) return;
        setHasCheckedIn(result.hasCheckedIn);
        setTodayCheckIn(result.checkin);
        if (result.checkin) {
          setMood(result.checkin.mood);
          setPlan(result.checkin.plan ?? "");
          setRiskLevel(result.checkin.riskLevel ?? "MEDIUM");
          setAiMessage(result.checkin.aiMessage);
          publishState(onStateChange, {
            hasCheckedIn: true,
            riskLevel: result.checkin.riskLevel ?? "MEDIUM",
            aiMessage: result.checkin.aiMessage ?? null,
            mood: result.checkin.mood,
          });
        } else {
          publishState(onStateChange, {
            hasCheckedIn: result.hasCheckedIn,
            riskLevel: null,
            aiMessage: null,
            mood: null,
          });
        }
      } catch {
        if (!active) return;
        setHasCheckedIn(false);
        setTodayCheckIn(null);
        publishState(onStateChange, {
          hasCheckedIn: false,
          riskLevel: null,
          aiMessage: null,
          mood: null,
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, [onStateChange, userId]);

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createDailyCheckIn({
        userId,
        mood,
        plan: plan.trim() || undefined,
        riskLevel,
      });
      setTodayCheckIn(result.checkin);
      setHasCheckedIn(true);
      setAiMessage(result.aiMessage);
      publishState(onStateChange, {
        hasCheckedIn: true,
        riskLevel: result.checkin.riskLevel ?? riskLevel,
        aiMessage: result.aiMessage ?? null,
        mood: result.checkin.mood,
      });
    } catch {
      setError(t("checkin.error", { defaultValue: "Could not save check-in. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  const shellClass = isTerminal
    ? `rounded-lg border border-terminal-border bg-terminal-panel shadow-terminal-panel${compact ? " p-3" : " p-4 mb-6"}`
    : compact
        ? "rounded-2xl border border-border/80 bg-gradient-to-b from-bgPrimary to-bgSecondary/30 p-4 shadow-sm"
        : "mb-6 rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm";

  const titleClass = isTerminal
    ? `${compact ? "text-sm" : "text-base"} font-semibold text-terminal-text`
    : `${compact ? "text-sm" : "text-base"} font-semibold text-textPrimary`;

  const subtitleClass = isTerminal
    ? "mt-1 text-xs text-terminal-textSecondary"
    : "mt-1 text-sm text-textSecondary";

  const panelClass = isTerminal
    ? "rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 py-2.5"
    : "rounded-xl border border-border/80 bg-bgSecondary/50 px-3 py-2.5";

  const mindsetLabelClass = isTerminal
    ? "text-[10px] font-semibold uppercase tracking-[0.12em] text-terminal-textMuted"
    : "text-[10px] font-semibold uppercase tracking-[0.12em] text-textMuted";

  const mindsetBtnClass = (selected: boolean) => {
    const base =
      "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md border px-1 py-1.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terminal-cyan/40";
    const size = compact ? "text-[9px] leading-tight sm:text-[10px]" : "text-[10px] leading-tight sm:text-[11px]";
    if (isTerminal) {
      return `${base} ${size} ${
        selected
          ? "border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan"
          : "border-terminal-borderMuted bg-terminal-panelSecondary/60 text-terminal-textSecondary hover:border-terminal-cyan/30"
      }`;
    }
    return `${base} ${size} ${
      selected
        ? "border-brandDark bg-brandDark/10 text-brandDark"
        : "border-border bg-bgSecondary text-textSecondary hover:border-borderStrong"
    }`;
  };

  const mindsetIndicatorClass = (selected: boolean, level: number) => {
    if (!selected) {
      return isTerminal ? "bg-terminal-borderMuted/80" : "bg-border";
    }
    const intensity =
      level <= 2 ? "bg-terminal-warning" : level === 3 ? "bg-terminal-textMuted" : "bg-terminal-cyan";
    return intensity;
  };

  const skeletonClass = isTerminal ? "bg-terminal-panelSecondary" : "bg-bgSecondary";

  if (loading) {
    return (
      <section className={shellClass} aria-busy="true">
        <div className="animate-pulse space-y-3">
          <div className={`h-4 w-2/3 rounded ${skeletonClass}`} />
          <div className={`h-10 rounded-lg ${skeletonClass}`} />
          <div className={`h-20 rounded-lg ${skeletonClass}`} />
        </div>
      </section>
    );
  }

  if (hasCheckedIn) {
    const savedPlan = todayCheckIn?.plan?.trim() || plan.trim();
    const displayMood = todayCheckIn?.mood ?? mood;
    const displayRisk = todayCheckIn?.riskLevel ?? riskLevel;
    const coachNote = aiMessage ?? todayCheckIn?.aiMessage;

    return (
      <section className={shellClass}>
        <div className="space-y-4">
          <div>
            <p
              className={`text-[11px] font-semibold uppercase tracking-widest ${
                isTerminal ? "text-terminal-cyan" : "text-brandCyan"
              }`}
            >
              {t("checkin.done.eyebrow", { defaultValue: "Today" })}
            </p>
            <h2 className={`${titleClass} mt-1`}>
              {t("checkin.done.title", { defaultValue: "Your plan for today" })}
            </h2>
          </div>

          <div className={panelClass}>
            <div className="min-w-0 space-y-1.5">
              <p
                className={`text-[11px] ${
                  isTerminal ? "text-terminal-textSecondary" : "text-textSecondary"
                }`}
              >
                <span
                  className={`font-semibold uppercase tracking-wide ${
                    isTerminal ? "text-terminal-textMuted" : "text-textMuted"
                  }`}
                >
                  {t("checkin.mindset.label", { defaultValue: "Mindset" })}:{" "}
                </span>
                {moodLabel(t, displayMood, compact)}
              </p>
              <p
                className={`text-[11px] ${
                  isTerminal ? "text-terminal-textSecondary" : "text-textSecondary"
                }`}
              >
                <span
                  className={`font-semibold uppercase tracking-wide ${
                    isTerminal ? "text-terminal-textMuted" : "text-textMuted"
                  }`}
                >
                  {t("checkin.risk.label", { defaultValue: "Risk" })}:{" "}
                </span>
                {t(`checkin.risk.${displayRisk}`, { defaultValue: displayRisk })}
              </p>
              <p
                className={`text-sm leading-snug ${
                  isTerminal ? "text-terminal-text" : "text-textPrimary"
                }`}
              >
                <span
                  className={`font-semibold uppercase tracking-wide ${
                    isTerminal ? "text-terminal-textMuted" : "text-textMuted"
                  }`}
                >
                  {t("checkin.plan.label", { defaultValue: "Plan" })}:{" "}
                </span>
                {savedPlan || t("checkin.done.noPlan", { defaultValue: "No plan saved — add one tomorrow morning." })}
              </p>
            </div>
          </div>

          {coachNote ? (
            <p
              className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${
                isTerminal
                  ? "border-terminal-cyan/25 bg-terminal-cyan/10 text-terminal-text"
                  : "border-brandCyan/20 bg-brandCyan/5 text-textPrimary"
              }`}
            >
              <span className={`font-semibold ${isTerminal ? "text-terminal-cyan" : "text-brandDark"}`}>
                {t("checkin.done.aiLabel", { defaultValue: "Coach note" })}:{" "}
              </span>
              {coachNote}
            </p>
          ) : null}

          <div className="grid gap-2">
            {isTerminal ? (
              <>
                <Link to="/behavioral-coach">
                  <TerminalButton variant="primary" size="sm" className="w-full">
                    {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                  </TerminalButton>
                </Link>
                <Link to="/paper-trading">
                  <TerminalButton variant="secondary" size="sm" className="w-full">
                    {t("checkin.done.paperCta", { defaultValue: "Paper trading" })}
                  </TerminalButton>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/behavioral-coach"
                  className="inline-flex items-center justify-center rounded-xl bg-brandDark px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                </Link>
                <Link
                  to="/paper-trading"
                  className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-brandDark transition hover:border-brandDark/40 hover:bg-bgSecondary/80"
                >
                  {t("checkin.done.paperCta", { defaultValue: "Paper trading" })}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  const riskBtn = (selected: boolean) =>
    isTerminal
      ? selected
        ? "border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan"
        : "border-terminal-borderMuted bg-terminal-panelSecondary/60 text-terminal-textSecondary hover:border-terminal-cyan/30"
      : selected
        ? "border-brandDark bg-brandDark text-white"
        : "border-border bg-bgSecondary text-textSecondary hover:border-borderStrong";

  const inputClass = isTerminal
    ? `w-full rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-terminal-text placeholder:text-terminal-textMuted outline-none ring-terminal-cyan/40 transition focus:ring`
    : `w-full rounded-lg border border-border bg-bgSecondary px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-textPrimary outline-none ring-brandCyan/40 transition focus:ring`;

  const submitBtnClass = isTerminal
    ? ""
    : `w-full rounded-xl bg-brandDark ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"} font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60`;

  return (
    <section className={shellClass}>
      <div className="space-y-4">
        <div>
          <h2 className={titleClass}>{t("checkin.title", { defaultValue: "Daily Check-In" })}</h2>
          {compact ? null : (
            <p className={subtitleClass}>
              {t("checkin.subtitle", { defaultValue: "Set your mindset before the market opens." })}
            </p>
          )}
        </div>

        <div>
          <p className={mindsetLabelClass}>{t("checkin.mindset.label", { defaultValue: "Mindset" })}</p>
          <div
            className="mt-1.5 grid grid-cols-5 gap-1"
            role="group"
            aria-label={t("checkin.mindset.label", { defaultValue: "Mindset" })}
          >
            {MOOD_VALUES.map((value) => {
              const selected = mood === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMood(value)}
                  className={mindsetBtnClass(selected)}
                  aria-pressed={selected}
                  aria-label={moodLabel(t, value, false)}
                >
                  <span
                    className={`h-0.5 w-full max-w-[2rem] rounded-full ${mindsetIndicatorClass(selected, value)}`}
                    aria-hidden
                  />
                  <span className="truncate px-0.5">{moodLabel(t, value, compact)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            className={`mb-1 block ${compact ? "text-xs" : "text-sm"} ${
              isTerminal ? "text-terminal-textSecondary" : "text-textSecondary"
            }`}
          >
            {t("dashboard.checkIn.planPlaceholder", { defaultValue: "What is your plan today?" })}
          </label>
          <textarea
            value={plan}
            onChange={(event) => setPlan(event.target.value.slice(0, 200))}
            rows={compact ? 2 : 2}
            maxLength={200}
            className={inputClass}
            placeholder={t("checkin.planPlaceholder", { defaultValue: "Optional..." })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {RISK_LEVELS.map((level) => {
            const selected = riskLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setRiskLevel(level)}
                className={`rounded-lg border ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} font-semibold tracking-wide ${riskBtn(selected)}`}
              >
                {t(`checkin.risk.${level}`, { defaultValue: level })}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {isTerminal ? (
            <TerminalButton
              type="button"
              variant="primary"
              size="sm"
              className="w-full"
              disabled={submitting}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {submitting
                ? t("checkin.submitting", { defaultValue: "Saving..." })
                : t("checkin.submit", { defaultValue: "Start trading day" })}
            </TerminalButton>
          ) : (
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting}
              className={submitBtnClass}
            >
              {submitting
                ? t("checkin.submitting", { defaultValue: "Saving..." })
                : t("checkin.submit", { defaultValue: "Start trading day" })}
            </button>
          )}
          {error ? (
            <p className={`text-sm ${isTerminal ? "text-terminal-negative" : "text-negative"}`}>{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
