import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createWeeklyReview, getCurrentWeeklyReview, getWeeklyReviewHistory, type WeeklyReview } from "../services/api";
import {
  TERMINAL_BADGE,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_INPUT,
  TERMINAL_INSIGHT_CARD,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatLocaleDate, formatLocaleDateRange } from "../utils/formatters";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
const SLIDER_CYAN = "#22d3ee";
const SLIDER_TRACK = "rgba(148, 163, 184, 0.25)";

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

function toWeekRangeLabel(weekStart: string | undefined, language?: string): string {
  const base = weekStart ? new Date(weekStart) : new Date();
  const start = new Date(base);
  const weekday = start.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + offsetToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return formatLocaleDateRange(start, end, language);
}

function scoreAverage(review: WeeklyReview): string {
  const average = (review.answers.q1 + review.answers.q2 + review.answers.q3) / 3;
  return average.toFixed(1);
}

export function WeeklyReviewPage() {
  const { t, i18n } = useTranslation();
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
  const weekRangeLabel = useMemo(
    () => toWeekRangeLabel(current?.weekStart, i18n.language),
    [current?.weekStart, i18n.language],
  );

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
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>Weekly Review</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>{t("weekly.subtitle")}</p>
          <div className={TERMINAL_BADGE}>
            {t("weekly.weekOf")}: {weekRangeLabel}
          </div>
        </header>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        <section className="space-y-4">
          <div className={TERMINAL_INTELLIGENCE_PANEL}>
            <h2 className="text-lg font-semibold text-terminal-cyan">{t("weekly.title")}</h2>
            <p className="mt-1 text-sm text-terminal-textMuted">{t("weekly.subtitle")}</p>
          </div>

          {SCORE_QUESTIONS.map(({ key, index }) => {
            const sliderPercentage = ((form[key] - 1) / 4) * 100;
            return (
              <article key={key} className={TERMINAL_INTELLIGENCE_PANEL}>
                <div className="mb-4 flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-terminal-cyan/15 text-sm font-semibold text-terminal-cyan">
                    {index}
                  </span>
                  <label className="pt-1 text-sm font-semibold text-terminal-text">{t(`weekly.questions.q${index}`)}</label>
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
                    style={{ background: `linear-gradient(90deg, ${SLIDER_CYAN} ${sliderPercentage}%, ${SLIDER_TRACK} ${sliderPercentage}%)` }}
                  />
                  <div className="w-12 rounded-lg border border-terminal-cyan/35 bg-terminal-cyan/10 py-1 text-center text-sm font-semibold text-terminal-cyan">
                    {form[key]}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-terminal-textMuted">
                  <span>1</span>
                  <span>5</span>
                </div>
              </article>
            );
          })}

          {REFLECTION_QUESTIONS.map(({ key, index }) => (
            <article key={key} className={TERMINAL_INTELLIGENCE_PANEL}>
              <div className="mb-4 flex items-start gap-3">
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-terminal-cyan/15 text-sm font-semibold text-terminal-cyan">
                  {index}
                </span>
                <label className="pt-1 text-sm font-semibold text-terminal-text">{t(`weekly.questions.q${index}`)}</label>
              </div>
              <textarea
                rows={4}
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={t(`weekly.placeholders.q${index}`)}
                className={`min-h-[120px] ${TERMINAL_INPUT}`}
              />
            </article>
          ))}

          <button type="button" onClick={() => void onSubmit()} disabled={!canSubmit} className={`w-full ${TERMINAL_BUTTON_PRIMARY}`}>
            {submitting ? t("weekly.submitting") : t("weekly.submit")}
          </button>
        </section>

        {(showReveal || current?.aiLetter || submitting) && (
          <section
            className={TERMINAL_INSIGHT_CARD}
            style={{ animation: "weeklyReviewFadeIn 0.45s ease-out" }}
          >
            <h2 className="text-lg font-semibold text-terminal-cyan">{t("weekly.aiLetterTitle")}</h2>
            {submitting ? (
              <div className="mt-4 flex items-center gap-2 text-terminal-textSecondary">
                <span className="h-2 w-2 animate-bounce rounded-full bg-terminal-cyan/90 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-terminal-cyan/90 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-terminal-cyan/90" />
                <span className="ml-1 text-sm">{t("weekly.generating")}</span>
              </div>
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-2xl leading-relaxed text-terminal-text md:text-3xl">
                "{current?.aiLetter ?? t("weekly.aiLetterEmpty")}"
              </p>
            )}
            {current?.growthScore != null ? (
              <div className={`mt-5 ${TERMINAL_BADGE}`}>
                {t("weekly.growthScore")}: {current.growthScore}/100
              </div>
            ) : null}
          </section>
        )}

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <h2 className="mb-4 text-lg font-semibold text-terminal-cyan">{t("weekly.historyTitle")}</h2>
          {loading ? (
            <p className="text-sm text-terminal-textMuted">{t("common.loading")}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-terminal-textMuted">{t("weekly.emptyHistory")}</p>
          ) : (
            <div className="space-y-3">
              {history.map((row) => (
                <article key={row.id} className={TERMINAL_INTELLIGENCE_CARD}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-terminal-text">
                      {t("weekly.weekOf", { defaultValue: "Week of" })}: {formatLocaleDate(row.weekStart, i18n.language)}
                    </p>
                    <span className="rounded-full border border-terminal-cyan/35 bg-terminal-cyan/10 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                      Avg {scoreAverage(row)}/5
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-terminal-textMuted">{formatLocaleDate(row.createdAt, i18n.language)}</p>
                  {row.aiLetter ? <p className="mt-3 text-sm leading-6 text-terminal-textSecondary">{row.aiLetter}</p> : null}
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
            border: 3px solid rgb(15 23 42);
            background: ${SLIDER_CYAN};
            box-shadow: 0 4px 10px rgba(34, 211, 238, 0.25);
          }
          .weekly-review-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 9999px;
            border: 3px solid rgb(15 23 42);
            background: ${SLIDER_CYAN};
            box-shadow: 0 4px 10px rgba(34, 211, 238, 0.25);
          }
        `}</style>
      </div>
    </div>
  );
}
