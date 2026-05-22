import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  calculateDividendCompound,
  type DividendCompoundResponse,
} from "../services/api";
import {
  GLASS_BTN_PRIMARY,
  GLASS_HERO,
  GLASS_INPUT,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
  GLASS_STAT_CARD,
} from "../components/behavioral-coach/glassStyles";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCurrency as formatMoney } from "../utils/formatters";

type FormState = {
  company: string;
  investmentAmount: number;
  years: number;
  reinvesting: boolean;
};

const DEFAULT_FORM: FormState = {
  company: "AAPL",
  investmentAmount: 25000,
  years: 12,
  reinvesting: true,
};

const DIVIDEND_YIELD_BY_COMPANY: Record<string, number> = {
  AAPL: 0.6,
  MSFT: 0.8,
  KO: 3.1,
  O: 5.2,
  PEP: 2.8,
  XOM: 3.4,
  PG: 2.4,
};

function sliderFillStyle(value: number, min: number, max: number): CSSProperties {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(90deg, ${colors.brandCyan} 0%, ${colors.brandCyan} ${pct}%, ${colors.bgTertiary} ${pct}%, ${colors.bgTertiary} 100%)`,
    accentColor: colors.brandCyan,
  };
}

export function DividendCompoundPage() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DividendCompoundResponse | null>(null);

  const selectedResult = useMemo(() => {
    if (!result) return null;
    return form.reinvesting ? result.withReinvesting : result.withoutReinvesting;
  }, [form.reinvesting, result]);

  const totalDividends = useMemo(() => {
    if (!selectedResult) return 0;
    return Math.max(selectedResult.final - form.investmentAmount, 0);
  }, [form.investmentAmount, selectedResult]);

  const cagr = useMemo(() => {
    if (!selectedResult || form.investmentAmount <= 0) return 0;
    const ratio = selectedResult.final / form.investmentAmount;
    if (ratio <= 0) return 0;
    return (Math.pow(ratio, 1 / form.years) - 1) * 100;
  }, [form.investmentAmount, form.years, selectedResult]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedCompany = form.company.trim().toUpperCase();
      const dividendYield = DIVIDEND_YIELD_BY_COMPANY[normalizedCompany] ?? 4;
      const response = await calculateDividendCompound({
        initialAmount: form.investmentAmount,
        monthlyContribution: 0,
        dividendYield,
        years: form.years,
      });
      setResult(response);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${GLASS_PAGE_BG} px-4 py-10`}>
      <div className="mx-auto max-w-5xl">
        <header className={GLASS_HERO}>
          <h1 className={GLASS_PAGE_TITLE}>{t("dividendcompound.title", { defaultValue: "Dividend Compound Calculator" })}</h1>
          <p className={`${GLASS_PAGE_SUBTITLE} mt-2`}>
            {t("dividendcompound.subtitle", {
              defaultValue: "Simulate portfolio growth with dividend reinvestment vs cash payout.",
            })}
          </p>
        </header>

        <form onSubmit={onSubmit} className={`${GLASS_SECTION} mt-8`}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-white/70">{t("dividendcompound.company", { defaultValue: "Company" })}</span>
              <input
                type="text"
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className={GLASS_INPUT}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-white/70">{t("dividendcompound.withReinvesting", { defaultValue: "Reinvest dividends" })}</span>
              <div className="grid grid-cols-2 rounded-xl border border-white/15 p-1">
                {[
                  { label: t("common.yes", { defaultValue: "Yes" }), value: true },
                  { label: t("common.no", { defaultValue: "No" }), value: false },
                ].map((option) => {
                  const active = form.reinvesting === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, reinvesting: option.value }))}
                      className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: active ? colors.brandCyan : "transparent",
                        color: active ? colors.brandDark : colors.textSecondary,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="flex items-center justify-between font-semibold" style={{ color: colors.textSecondary }}>
                <span>{t("dividendcompound.initialAmount", { defaultValue: "Initial amount (PLN)" })}</span>
                <span style={{ color: colors.brandDark }}>{formatMoney(form.investmentAmount, "USD", i18n.language)}</span>
              </span>
              <input
                type="range"
                min={5000}
                max={300000}
                step={1000}
                value={form.investmentAmount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, investmentAmount: Number(event.target.value) }))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                style={sliderFillStyle(form.investmentAmount, 5000, 300000)}
              />
              <div className="flex justify-between text-xs" style={{ color: colors.textMuted }}>
                <span>{formatMoney(5000, "USD", i18n.language)}</span>
                <span>{formatMoney(300000, "USD", i18n.language)}</span>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="flex items-center justify-between font-semibold" style={{ color: colors.textSecondary }}>
                <span>{t("dividendcompound.years", { defaultValue: "Time period (years)" })}</span>
                <span className="text-[#22d3ee]">{t("dividendcompound.yearsValue", { count: form.years, defaultValue: `${form.years} years` })}</span>
              </span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={form.years}
                onChange={(event) => setForm((prev) => ({ ...prev, years: Number(event.target.value) }))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                style={sliderFillStyle(form.years, 1, 30)}
              />
              <div className="flex justify-between text-xs" style={{ color: colors.textMuted }}>
                <span>{t("dividendcompound.yearMin", { defaultValue: "1 year" })}</span>
                <span>{t("dividendcompound.yearMax", { count: 30, defaultValue: "30 years" })}</span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${GLASS_BTN_PRIMARY} mt-6 disabled:opacity-60`}
          >
            {loading ? t("common.calculating") : t("dividendcompound.calculate", { defaultValue: "Calculate" })}
          </button>
        </form>

        {error ? (
          <p className="mt-4 text-sm" style={{ color: colors.negative }}>
            {error}
          </p>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">{t("dividendcompound.chartTitle", { defaultValue: "Portfolio value year by year" })}</p>
            <p className="mt-3 text-4xl font-extrabold text-white">
              {selectedResult ? formatMoney(selectedResult.final, "USD", i18n.language) : "-"}
            </p>
          </article>

          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">{t("dividendcompound.difference", { defaultValue: "Difference (compound bonus)" })}</p>
            <p className="mt-3 text-4xl font-extrabold text-white">
              {selectedResult ? formatMoney(totalDividends, "USD", i18n.language) : "-"}
            </p>
          </article>

          <article className={GLASS_STAT_CARD}>
            <p className="text-xs uppercase tracking-wide text-white/50">CAGR %</p>
            <p className="mt-3 text-4xl font-extrabold text-[#22d3ee]">
              {selectedResult ? `${cagr.toFixed(2)}%` : "-"}
            </p>
          </article>
        </section>

        <section className={`${GLASS_SECTION} mt-6`}>
          <p className="text-xs uppercase tracking-wide text-white/50">{t("dividendcompound.chartTitle", { defaultValue: "Portfolio value year by year" })}</p>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <svg viewBox="0 0 100 36" className="h-40 w-full" role="img" aria-label="Dividend growth placeholder">
              <polyline
                points="4,31 20,29 34,27 49,22 64,18 78,12 96,6"
                fill="none"
                stroke={colors.brandCyan}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>
      </div>
    </div>
  );
}
