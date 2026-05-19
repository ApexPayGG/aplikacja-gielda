import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { createDailyCheckIn, getDailyCheckInToday, type DailyCheckInRiskLevel } from "../services/api";

const USER_ID_FALLBACK = "";
const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😄"] as const;
const RISK_LEVELS: DailyCheckInRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

type DailyCheckInWidgetProps = {
  compact?: boolean;
};

function readUserId(): string {
  if (typeof window === "undefined") return USER_ID_FALLBACK;
  const value = window.localStorage.getItem("userId")?.trim();
  return value || USER_ID_FALLBACK;
}

export function DailyCheckInWidget({ compact = false }: DailyCheckInWidgetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = useMemo(() => user?.id ?? readUserId(), [user?.id]);

  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
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
        setVisible(!result.hasCheckedIn);
      } catch {
        if (!active) return;
        setVisible(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, [userId]);

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
      setAiMessage(result.aiMessage);
      setTimeout(() => {
        setVisible(false);
      }, 3000);
    } catch {
      setError(t("checkin.error", { defaultValue: "Could not save check-in. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !visible) return null;

  return (
    <section
      className={`${compact ? "mb-0 rounded-xl p-3" : "mb-6 rounded-2xl p-4"} border border-border bg-bgPrimary shadow-sm`}
    >
      {aiMessage ? (
        <div className="rounded-xl border border-positive/30 bg-positive/10 p-4 text-positive">
          <p className="text-sm font-medium">{aiMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className={`${compact ? "text-sm" : "text-base"} font-semibold text-textPrimary`}>
              {t("checkin.title", { defaultValue: "Daily Check-In" })}
            </h2>
            {compact ? null : (
              <p className="mt-1 text-sm text-textSecondary">
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
                  className={`rounded-lg border ${compact ? "px-2 py-1.5 text-lg" : "px-3 py-2 text-xl"} transition ${
                    selected ? "border-brandDark bg-brandDark/10" : "border-border bg-bgSecondary hover:border-borderStrong"
                  }`}
                  aria-label={`${t("checkin.moodLabel", { defaultValue: "Mood" })} ${value}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          <div>
            <label className={`mb-1 block ${compact ? "text-xs" : "text-sm"} text-textSecondary`}>
              {t("dashboard.checkIn.planPlaceholder", { defaultValue: "What is your plan today?" })}
            </label>
            <textarea
              value={plan}
              onChange={(event) => setPlan(event.target.value.slice(0, 200))}
              rows={compact ? 1 : 2}
              maxLength={200}
              className={`w-full rounded-lg border border-border bg-bgSecondary px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-textPrimary outline-none ring-brandCyan/40 transition focus:ring`}
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
                  className={`rounded-lg border ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} font-semibold tracking-wide ${
                    selected
                      ? "border-brandDark bg-brandDark text-white"
                      : "border-border bg-bgSecondary text-textSecondary hover:border-borderStrong"
                  }`}
                >
                  {t(`checkin.risk.${level}`, { defaultValue: level })}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={submitting}
              className={`rounded-lg bg-brandDark ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-semibold text-white transition hover:bg-brandMedium disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {submitting
                ? t("checkin.submitting", { defaultValue: "Saving..." })
                : t("checkin.submit", { defaultValue: "Start trading day" })}
            </button>
            {error ? <p className="text-sm text-negative">{error}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
