import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GLASS_BTN_PRIMARY, GLASS_BTN_SECONDARY, GLASS_WIDGET_SHELL } from "./behavioral-coach/glassStyles";
import { TerminalButton } from "./terminal";
import { useAuth } from "../context/AuthContext";
import {
  createDailyCheckIn,
  getDailyCheckInToday,
  type DailyCheckIn,
  type DailyCheckInRiskLevel,
} from "../services/api";

const USER_ID_FALLBACK = "";
const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😄"] as const;
const RISK_LEVELS: DailyCheckInRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

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

function moodEmoji(mood: number): string {
  return MOOD_EMOJIS[Math.min(MOOD_EMOJIS.length, Math.max(1, mood)) - 1] ?? MOOD_EMOJIS[2];
}

function publishState(
  onStateChange: DailyCheckInWidgetProps["onStateChange"],
  state: DailyCheckInWidgetState,
): void {
  onStateChange?.(state);
}

export function DailyCheckInWidget({
  compact = false,
  appearance = "light",
  onStateChange,
}: DailyCheckInWidgetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = useMemo(() => user?.id ?? readUserId(), [user?.id]);
  const isGlass = appearance === "glass";
  const isTerminal = appearance === "terminal";

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
    ? `rounded-lg border border-terminal-border bg-terminal-panel p-4 shadow-terminal-panel${compact ? "" : " mb-6"}`
    : isGlass
      ? `${GLASS_WIDGET_SHELL}${compact ? "" : " mb-6"}`
      : compact
        ? "rounded-2xl border border-border/80 bg-gradient-to-b from-bgPrimary to-bgSecondary/30 p-4 shadow-sm"
        : "mb-6 rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm";

  const titleClass = isTerminal
    ? `${compact ? "text-sm" : "text-base"} font-semibold text-terminal-text`
    : isGlass
      ? `${compact ? "text-sm" : "text-base"} font-semibold text-white`
      : `${compact ? "text-sm" : "text-base"} font-semibold text-textPrimary`;

  const subtitleClass = isTerminal
    ? "mt-1 text-xs text-terminal-textSecondary"
    : isGlass
      ? "mt-1 text-sm text-white/60"
      : "mt-1 text-sm text-textSecondary";

  const panelClass = isTerminal
    ? "flex items-center gap-3 rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 py-2.5"
    : isGlass
      ? "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm"
      : "flex items-center gap-3 rounded-xl border border-border/80 bg-bgSecondary/50 px-3 py-2.5";

  const skeletonClass = isTerminal ? "bg-terminal-panelSecondary" : isGlass ? "bg-white/10" : "bg-bgSecondary";

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
                isTerminal || isGlass ? "text-terminal-cyan" : "text-brandCyan"
              }`}
            >
              {t("checkin.done.eyebrow", { defaultValue: "Today" })}
            </p>
            <h2 className={`${titleClass} mt-1`}>
              {t("checkin.done.title", { defaultValue: "Your plan for today" })}
            </h2>
          </div>

          <div className={panelClass}>
            <span className="text-2xl" aria-hidden>
              {moodEmoji(displayMood)}
            </span>
            <div className="min-w-0">
              <p
                className={`text-xs font-medium ${
                  isTerminal ? "text-terminal-textMuted" : isGlass ? "text-white/50" : "text-textMuted"
                }`}
              >
                {t(`checkin.risk.${displayRisk}`, { defaultValue: displayRisk })}
              </p>
              <p
                className={`mt-0.5 text-sm ${
                  isTerminal ? "text-terminal-text" : isGlass ? "text-white/90" : "text-textPrimary"
                }`}
              >
                {savedPlan || t("checkin.done.noPlan", { defaultValue: "No plan saved — add one tomorrow morning." })}
              </p>
            </div>
          </div>

          {coachNote ? (
            <p
              className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${
                isTerminal || isGlass
                  ? "border-terminal-cyan/25 bg-terminal-cyan/10 text-terminal-text"
                  : "border-brandCyan/20 bg-brandCyan/5 text-textPrimary"
              }`}
            >
              <span className={`font-semibold ${isTerminal || isGlass ? "text-terminal-cyan" : "text-brandDark"}`}>
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
                  className={
                    isGlass
                      ? GLASS_BTN_PRIMARY
                      : "inline-flex items-center justify-center rounded-xl bg-brandDark px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  }
                >
                  {t("checkin.done.coachCta", { defaultValue: "Behavioral Coach" })}
                </Link>
                <Link
                  to="/paper-trading"
                  className={
                    isGlass
                      ? GLASS_BTN_SECONDARY
                      : "inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-brandDark transition hover:border-brandDark/40 hover:bg-bgSecondary/80"
                  }
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

  const moodBtn = (selected: boolean) =>
    isTerminal || isGlass
      ? selected
        ? "border-terminal-cyan bg-terminal-cyan/15"
        : "border-terminal-borderMuted bg-terminal-panelSecondary/60 hover:border-terminal-cyan/30"
      : selected
        ? "border-brandDark bg-brandDark/10"
        : "border-border bg-bgSecondary hover:border-borderStrong";

  const riskBtn = (selected: boolean) =>
    isTerminal
      ? selected
        ? "border-terminal-cyan bg-terminal-cyan/15 text-terminal-cyan"
        : "border-terminal-borderMuted bg-terminal-panelSecondary/60 text-terminal-textSecondary hover:border-terminal-cyan/30"
      : isGlass
        ? selected
          ? "border-[#22d3ee] bg-[#22d3ee]/15 text-white"
          : "border-white/15 bg-white/5 text-white/70 hover:border-white/25"
        : selected
          ? "border-brandDark bg-brandDark text-white"
          : "border-border bg-bgSecondary text-textSecondary hover:border-borderStrong";

  const inputClass = isTerminal
    ? `w-full rounded-lg border border-terminal-borderMuted bg-terminal-panelSecondary/60 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-terminal-text placeholder:text-terminal-textMuted outline-none ring-terminal-cyan/40 transition focus:ring`
    : isGlass
      ? `w-full rounded-lg border border-white/15 bg-white/5 px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-white placeholder:text-white/40 outline-none ring-[#22d3ee]/40 transition focus:ring`
      : `w-full rounded-lg border border-border bg-bgSecondary px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-textPrimary outline-none ring-brandCyan/40 transition focus:ring`;

  const submitBtnClass = isTerminal
    ? ""
    : isGlass
      ? `w-full ${GLASS_BTN_PRIMARY} ${compact ? "px-3 py-2 text-xs" : ""} disabled:cursor-not-allowed disabled:opacity-60`
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

        <div className="flex flex-wrap gap-2">
          {MOOD_EMOJIS.map((emoji, idx) => {
            const value = idx + 1;
            const selected = mood === value;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => setMood(value)}
                className={`rounded-lg border ${compact ? "px-2 py-1.5 text-lg" : "px-3 py-2 text-xl"} transition ${moodBtn(selected)}`}
                aria-label={`${t("checkin.moodLabel", { defaultValue: "Mood" })} ${value}`}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        <div>
          <label
            className={`mb-1 block ${compact ? "text-xs" : "text-sm"} ${
              isTerminal ? "text-terminal-textSecondary" : isGlass ? "text-white/60" : "text-textSecondary"
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
            <p className={`text-sm ${isTerminal || isGlass ? "text-terminal-negative" : "text-negative"}`}>{error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
