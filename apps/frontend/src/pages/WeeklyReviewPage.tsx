import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createWeeklyReview, getCurrentWeeklyReview, getWeeklyReviewHistory, type WeeklyReview } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

type FormState = {
  q1: number;
  q2: number;
  q3: number;
  q4: string;
  q5: string;
};

const INITIAL_FORM: FormState = {
  q1: 3,
  q2: 3,
  q3: 3,
  q4: "",
  q5: "",
};

type ScoreQuestionKey = "q1" | "q2" | "q3";
type ReflectionQuestionKey = "q4" | "q5";

const SCORE_QUESTIONS: Array<{ key: ScoreQuestionKey; index: number }> = [
  { key: "q1", index: 1 },
  { key: "q2", index: 2 },
  { key: "q3", index: 3 },
];

const REFLECTION_QUESTIONS: Array<{ key: ReflectionQuestionKey; index: number }> = [
  { key: "q4", index: 4 },
  { key: "q5", index: 5 },
];

function toDateLabel(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toWeekRangeLabel(weekStart?: string): string {
  const base = weekStart ? new Date(weekStart) : new Date();
  const start = new Date(base);
  const weekday = start.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offsetToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${toDateLabel(start)} - ${toDateLabel(end)}`;
}

function scoreAverage(review: WeeklyReview): string {
  const average = (review.answers.q1 + review.answers.q2 + review.answers.q3) / 3;
  return average.toFixed(1);
}

export function WeeklyReviewPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [history, setHistory] = useState<WeeklyReview[]>([]);
  const [current, setCurrent] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [currentRes, historyRes] = await Promise.all([
        getCurrentWeeklyReview(USER_ID),
        getWeeklyReviewHistory(USER_ID, 8),
      ]);
      setCurrent(currentRes.review);
      setHistory(historyRes.reviews);
      if (currentRes.review) {
        setForm({
          q1: currentRes.review.answers.q1,
          q2: currentRes.review.answers.q2,
          q3: currentRes.review.answers.q3,
          q4: currentRes.review.answers.q4,
          q5: currentRes.review.answers.q5,
        });
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const canSubmit = useMemo(() => {
    return form.q4.trim().length > 0 && form.q5.trim().length > 0 && !submitting;
  }, [form.q4, form.q5, submitting]);
  const weekRangeLabel = useMemo(() => toWeekRangeLabel(current?.weekStart), [current?.weekStart]);

  async function onSubmit(): Promise<void> {
    if (!canSubmit) return;
    setSubmitting(true);
    setShowReveal(true);
    setError(null);
    try {
      const { review } = await createWeeklyReview({
        userId: USER_ID,
        q1: form.q1,
        q2: form.q2,
        q3: form.q3,
        q4: form.q4.trim(),
        q5: form.q5.trim(),
      });
      setCurrent(review);
      await loadData();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSubmitting(false);
      window.setTimeout(() => setShowReveal(false), 900);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 text-textPrimary">
      <header
        className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_16px_40px_rgba(45,10,107,0.08)]"
        style={{ background: `linear-gradient(120deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <h1 className="text-3xl font-bold text-brandDark">Weekly Review</h1>
        <p className="mt-2 text-sm text-textSecondary">{t("weekly.subtitle")}</p>
        <div className="mt-4 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: colors.brandDark }}>
          {t("weekly.weekOf")}: {weekRangeLabel}
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-negative/25 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">{error}</div>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_14px_32px_rgba(45,10,107,0.08)]">
          <h2 className="text-lg font-semibold text-brandDark">{t("weekly.title")}</h2>
          <p className="mt-1 text-sm text-textSecondary">{t("weekly.subtitle")}</p>
        </div>

        {SCORE_QUESTIONS.map(({ key, index }) => {
          const sliderPercentage = ((form[key] - 1) / 4) * 100;
          return (
            <article key={key} className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]">
              <div className="mb-4 flex items-start gap-3">
                <span
                  className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: colors.brandDark }}
                >
                  {index}
                </span>
                <label className="pt-1 text-sm font-semibold text-textPrimary">{t(`weekly.questions.q${index}`)}</label>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="weekly-review-slider h-2 w-full cursor-pointer appearance-none rounded-full"
                  style={{ background: `linear-gradient(90deg, ${colors.brandCyan} ${sliderPercentage}%, ${colors.bgTertiary} ${sliderPercentage}%)` }}
                />
                <div
                  className="w-12 rounded-lg border py-1 text-center text-sm font-semibold"
                  style={{ borderColor: `${colors.brandDark}33`, color: colors.brandDark, backgroundColor: `${colors.brandDark}12` }}
                >
                  {form[key]}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-textMuted">
                <span>1</span>
                <span>5</span>
              </div>
            </article>
          );
        })}

        {REFLECTION_QUESTIONS.map(({ key, index }) => (
          <article key={key} className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_12px_28px_rgba(45,10,107,0.08)]">
            <div className="mb-4 flex items-start gap-3">
              <span
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: colors.brandDark }}
              >
                {index}
              </span>
              <label className="pt-1 text-sm font-semibold text-textPrimary">{t(`weekly.questions.q${index}`)}</label>
            </div>
            <textarea
              rows={4}
              value={form[key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={t(`weekly.placeholders.q${index}`)}
              className="min-h-[120px] w-full rounded-xl border border-border bg-bgSecondary px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/25"
            />
          </article>
        ))}

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSubmit}
          className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(45,10,107,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
        >
          {submitting ? t("weekly.submitting") : t("weekly.submit")}
        </button>
      </section>

      {(showReveal || current?.aiLetter || submitting) && (
        <section
          className="rounded-2xl border border-brandDark/20 p-6 text-white shadow-[0_22px_50px_rgba(45,10,107,0.4)]"
          style={{
            background: `linear-gradient(130deg, ${colors.brandDark}, ${colors.brandMedium})`,
            animation: "weeklyReviewFadeIn 0.45s ease-out",
          }}
        >
          <h2 className="text-lg font-semibold text-white">{t("weekly.aiLetterTitle")}</h2>
          {submitting ? (
            <div className="mt-4 flex items-center gap-2 text-white/80">
              <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
              <span className="ml-1 text-sm">{t("weekly.generating")}</span>
            </div>
          ) : (
            <p className="mt-4 whitespace-pre-wrap text-2xl leading-relaxed text-white md:text-3xl">
              "{current?.aiLetter ?? t("weekly.aiLetterEmpty")}"
            </p>
          )}
          {current?.growthScore != null ? (
            <div className="mt-5 inline-flex items-center rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              {t("weekly.growthScore")}: {current.growthScore}/100
            </div>
          ) : null}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-[0_16px_36px_rgba(45,10,107,0.08)]">
        <h2 className="mb-4 text-lg font-semibold text-brandDark">{t("weekly.historyTitle")}</h2>
        {loading ? (
          <p className="text-sm text-textMuted">{t("common.loading")}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-textMuted">{t("weekly.emptyHistory")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <article key={row.id} className="rounded-xl border border-border bg-bgPrimary p-4 shadow-[0_10px_22px_rgba(45,10,107,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-textPrimary">
                    {t("weekly.weekOf")}: {toDateLabel(row.weekStart)}
                  </p>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${colors.brandDark}16`, color: colors.brandDark }}
                  >
                    Avg {scoreAverage(row)}/5
                  </span>
                </div>
                <p className="mt-2 text-xs text-textMuted">{toDateLabel(row.createdAt)}</p>
                {row.aiLetter ? <p className="mt-3 text-sm leading-6 text-textSecondary">{row.aiLetter}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        @keyframes weeklyReviewFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .weekly-review-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 3px solid ${colors.bgPrimary};
          background: ${colors.brandDark};
          box-shadow: 0 4px 10px rgba(45, 10, 107, 0.25);
        }
        .weekly-review-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          border: 3px solid ${colors.bgPrimary};
          background: ${colors.brandDark};
          box-shadow: 0 4px 10px rgba(45, 10, 107, 0.25);
        }
      `}</style>
    </div>
  );
}
