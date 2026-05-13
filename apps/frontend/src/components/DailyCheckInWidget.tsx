import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { createDailyCheckIn, getDailyCheckInToday, type DailyCheckInRiskLevel } from "../services/api";

const USER_ID_FALLBACK = "";
const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😄"] as const;
const RISK_LEVELS: DailyCheckInRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

function readUserId(): string {
  if (typeof window === "undefined") return USER_ID_FALLBACK;
  const value = window.localStorage.getItem("userId")?.trim();
  return value || USER_ID_FALLBACK;
}

export function DailyCheckInWidget() {
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
    <section className="mb-6 rounded-2xl border border-accent/30 bg-slate-900/70 p-4 shadow-lg">
      {aiMessage ? (
        <div className="animate-pulse rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-100">
          <p className="text-sm font-medium">{aiMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {t("checkin.title", { defaultValue: "Daily Check-In" })}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t("checkin.subtitle", { defaultValue: "Set your mindset before the market opens." })}
            </p>
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
                  className={`rounded-lg border px-3 py-2 text-xl transition ${
                    selected
                      ? "border-accent bg-accent/20"
                      : "border-slate-700 bg-slate-800/80 hover:border-slate-500"
                  }`}
                  aria-label={`${t("checkin.moodLabel", { defaultValue: "Mood" })} ${value}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">
              {t("checkin.planLabel", { defaultValue: "What is your plan today?" })}
            </label>
            <textarea
              value={plan}
              onChange={(event) => setPlan(event.target.value.slice(0, 200))}
              rows={2}
              maxLength={200}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none ring-accent/40 transition focus:ring"
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
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-wide ${
                    selected
                      ? "border-accent bg-accent/20 text-white"
                      : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500"
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
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? t("checkin.submitting", { defaultValue: "Saving..." })
                : t("checkin.submit", { defaultValue: "Start trading day" })}
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
