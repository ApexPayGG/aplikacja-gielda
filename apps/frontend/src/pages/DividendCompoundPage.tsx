import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import {
  calculateDividendCompound,
  type DividendCompoundResponse,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DividendCompoundPage() {
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
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 space-y-2">
          <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
            Dividend Compound Calculator
          </h1>
          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Modeluj wzrost portfela dywidendowego wedlug zasad AMC Energy design system.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-6 shadow-sm"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                Spolka
              </span>
              <input
                type="text"
                value={form.company}
                onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value.toUpperCase() }))}
                placeholder="AAPL"
                className="rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                Reinwestowanie
              </span>
              <div className="grid grid-cols-2 rounded-xl border p-1" style={{ borderColor: colors.borderStrong }}>
                {[
                  { label: "Tak", value: true },
                  { label: "Nie", value: false },
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
                <span>Kwota inwestycji</span>
                <span style={{ color: colors.brandDark }}>{formatCurrency(form.investmentAmount)}</span>
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
                <span>5 000 PLN</span>
                <span>300 000 PLN</span>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              <span className="flex items-center justify-between font-semibold" style={{ color: colors.textSecondary }}>
                <span>Okres (lata)</span>
                <span style={{ color: colors.brandDark }}>{form.years} lat</span>
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
                <span>1 rok</span>
                <span>30 lat</span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: colors.brandDark }}
          >
            {loading ? "Liczenie..." : "Oblicz"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 text-sm" style={{ color: colors.negative }}>
            {error}
          </p>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article
            className="rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Koncowa wartosc
            </p>
            <p className="mt-3 text-4xl font-extrabold" style={{ color: colors.brandDark }}>
              {selectedResult ? formatCurrency(selectedResult.final) : "-"}
            </p>
          </article>

          <article
            className="rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Laczne dywidendy
            </p>
            <p className="mt-3 text-4xl font-extrabold" style={{ color: colors.brandDark }}>
              {selectedResult ? formatCurrency(totalDividends) : "-"}
            </p>
          </article>

          <article
            className="rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              CAGR %
            </p>
            <p className="mt-3 text-4xl font-extrabold" style={{ color: colors.brandDark }}>
              {selectedResult ? `${cagr.toFixed(2)}%` : "-"}
            </p>
          </article>
        </section>

        <section
          className="mt-6 rounded-2xl border p-6 shadow-sm"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Wykres wzrostu (placeholder)
          </p>
          <div
            className="mt-4 rounded-xl p-4"
            style={{ backgroundColor: colors.bgSecondary, border: `1px solid ${colors.border}` }}
          >
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
