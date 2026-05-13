import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createWeeklyReview, getCurrentWeeklyReview, getWeeklyReviewHistory, type WeeklyReview } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = "demo-user";

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

function toDateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 text-slate-100">
      <header>
        <h1 className="text-3xl font-bold text-white">{t("weekly.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("weekly.subtitle")}</p>
      </header>

      {error ? <div className="rounded-lg border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div> : null}

      <section className="neo-panel rounded-2xl p-6">
        <div className="space-y-6">
          {[1, 2, 3].map((idx) => (
            <div key={`q${idx}`} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-200">{t(`weekly.questions.q${idx}`)}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={form[`q${idx}` as "q1" | "q2" | "q3"]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [`q${idx}`]: Number(e.target.value) }))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-700"
                />
                <div className="w-10 rounded-md border border-brand-blue/40 bg-brand-blue/10 py-1 text-center font-mono text-brand-blue">
                  {form[`q${idx}` as "q1" | "q2" | "q3"]}
                </div>
              </div>
            </div>
          ))}

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-200">{t("weekly.questions.q4")}</label>
            <textarea
              rows={4}
              value={form.q4}
              onChange={(e) => setForm((prev) => ({ ...prev, q4: e.target.value }))}
              placeholder={t("weekly.placeholders.q4")}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-blue"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-200">{t("weekly.questions.q5")}</label>
            <textarea
              rows={4}
              value={form.q5}
              onChange={(e) => setForm((prev) => ({ ...prev, q5: e.target.value }))}
              placeholder={t("weekly.placeholders.q5")}
              className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-blue"
            />
          </div>

          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            className="rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-[#05250f] transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("weekly.submitting") : t("weekly.submit")}
          </button>
        </div>
      </section>

      {(showReveal || current?.aiLetter) && (
        <section
          className={`neo-panel rounded-2xl border border-brand-blue/40 bg-gradient-to-br from-brand-blue/10 to-brand-green/10 p-6 transition ${
            showReveal ? "scale-[1.01] animate-pulse" : ""
          }`}
        >
          <h2 className="text-lg font-semibold text-brand-blue">{t("weekly.aiLetterTitle")}</h2>
          {submitting ? (
            <div className="mt-4 flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-brand-blue" />
              <span className="ml-1 text-sm">{t("weekly.generating")}</span>
            </div>
          ) : (
            <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-100">{current?.aiLetter ?? t("weekly.aiLetterEmpty")}</p>
          )}
          {current?.growthScore != null ? (
            <div className="mt-4 inline-flex items-center rounded-full border border-brand-green/50 bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green">
              {t("weekly.growthScore")}: {current.growthScore}/100
            </div>
          ) : null}
        </section>
      )}

      <section className="neo-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">{t("weekly.historyTitle")}</h2>
        {loading ? (
          <p className="text-sm text-slate-400">{t("common.loading")}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">{t("weekly.emptyHistory")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((row) => (
              <article key={row.id} className="rounded-xl border border-slate-800 bg-brand-bg/65 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-200">
                    {t("weekly.weekOf")}: {toDateLabel(row.weekStart)}
                  </p>
                  <p className="text-xs text-slate-400">{toDateLabel(row.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  Q1:{row.answers.q1}/5 | Q2:{row.answers.q2}/5 | Q3:{row.answers.q3}/5
                </p>
                {row.aiLetter ? <p className="mt-2 text-sm leading-6 text-slate-200">{row.aiLetter}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
