import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateDividendCompound,
  type DividendCompoundResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type FormState = {
  initialAmount: string;
  monthlyContribution: string;
  dividendYield: string;
  years: number;
};

const DEFAULT_FORM: FormState = {
  initialAmount: "10000",
  monthlyContribution: "500",
  dividendYield: "4.5",
  years: 15,
};

function formatPln(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPlnCompact(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

export function DividendCompoundPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DividendCompoundResponse | null>(null);

  const chartData = useMemo(() => {
    if (!result) return [];
    const withMap = new Map(result.withReinvesting.chart.map((p) => [p.year, p.value]));
    const withoutMap = new Map(
      result.withoutReinvesting.chart.map((p) => [p.year, p.value]),
    );
    const years = Array.from(new Set([...withMap.keys(), ...withoutMap.keys()])).sort(
      (a, b) => a - b,
    );
    return years.map((year) => ({
      year,
      reinvest: withMap.get(year) ?? null,
      noReinvest: withoutMap.get(year) ?? null,
    }));
  }, [result]);

  const differencePct = useMemo(() => {
    if (!result) return 0;
    const base = result.withoutReinvesting.final;
    if (base <= 0) return 0;
    return (result.difference / base) * 100;
  }, [result]);

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await calculateDividendCompound({
        initialAmount: Number(form.initialAmount),
        monthlyContribution: Number(form.monthlyContribution),
        dividendYield: Number(form.dividendYield),
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
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t("dividendcompound.title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("dividendcompound.subtitle")}</p>
      </header>

      <form onSubmit={onSubmit} className="neo-panel rounded-xl p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("dividendcompound.initialAmount")}</span>
            <input
              type="number"
              min="0"
              step="100"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.initialAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, initialAmount: e.target.value }))
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("dividendcompound.monthlyContribution")}</span>
            <input
              type="number"
              min="0"
              step="50"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.monthlyContribution}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, monthlyContribution: e.target.value }))
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">{t("dividendcompound.dividendYield")}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              value={form.dividendYield}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dividendYield: e.target.value }))
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between text-slate-400">
              <span>{t("dividendcompound.years")}</span>
              <span className="font-semibold text-brand-blue">
                {t("dividendcompound.yearsValue", { count: form.years })}
              </span>
            </span>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={form.years}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, years: Number(e.target.value) }))
              }
              className="mt-1 accent-brand-blue"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>5</span>
              <span>30</span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-5 rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
        >
          {loading ? t("common.loading") : t("dividendcompound.calculate")}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}

      {result ? (
        <>
          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="neo-panel rounded-xl border border-brand-green/40 p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("dividendcompound.withReinvesting")}
              </p>
              <p className="mt-3 text-4xl font-extrabold text-brand-green">
                {formatPln(result.withReinvesting.final)}
              </p>
            </div>
            <div className="neo-panel rounded-xl border border-brand-border p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("dividendcompound.withoutReinvesting")}
              </p>
              <p className="mt-3 text-4xl font-extrabold text-slate-200">
                {formatPln(result.withoutReinvesting.final)}
              </p>
            </div>
          </section>

          <section className="neo-panel mt-6 rounded-xl border border-brand-blue/40 p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {t("dividendcompound.difference")}
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-blue">
              +{formatPln(result.difference)}
              <span className="ml-3 text-lg font-semibold text-brand-green">
                (+{differencePct.toFixed(1)}%)
              </span>
            </p>
          </section>

          <section className="neo-panel mt-8 rounded-xl p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              {t("dividendcompound.chartTitle")}
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4d" />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: t("dividendcompound.axisYear"),
                      fill: "#94a3b8",
                      fontSize: 11,
                      position: "insideBottomRight",
                      offset: -2,
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    width={72}
                    tickFormatter={(v: number) => formatPlnCompact(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a2332",
                      border: "1px solid #2d3a4d",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => formatPln(value)}
                    labelFormatter={(label: number) =>
                      t("dividendcompound.tooltipYear", { year: label })
                    }
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="reinvest"
                    name={t("dividendcompound.withReinvesting")}
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="noReinvest"
                    name={t("dividendcompound.withoutReinvesting")}
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
