import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_COUNTRY_ENGLISH_NAMES, TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_FORM_LABEL,
  TERMINAL_INPUT,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TOOL_HERO,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
  TERMINAL_TOOL_RESULT_CARD,
  TERMINAL_WARNING_PANEL,
} from "../components/terminal/terminalStyles";
import {
  calculateTax,
  getAlpacaSettings,
  getTaxSystems,
  saveAlpacaSettings,
  type TaxCalculateResponse,
  type TaxSystemItem,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatCurrency } from "../utils/money";

const DEFAULT_USER_ID = "";
const COUNTRY_PILLS = ["PL", "DE", "FR", "ES", "GB", "US", "JP", "KR", "TW", "IN", "CUSTOM"] as const;

type SummaryState = {
  taxDue: number;
  potentialSavings: number;
  suggestions: Array<{ title: string; body: string }>;
};

function readUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  const fromStorage = window.localStorage.getItem("userId")?.trim();
  return fromStorage || DEFAULT_USER_ID;
}

function parseNumericInput(input: string, fallback: number): number {
  if (!input.trim()) return fallback;
  const normalized = input.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildOptimizationSuggestions(params: {
  country: string;
  taxYear: string;
  losses: number;
  dividends: number;
  taxDue: number;
  taxName: string;
}): SummaryState["suggestions"] {
  const result: SummaryState["suggestions"] = [];

  if (params.losses <= 0) {
    result.push({
      title: "Loss harvesting",
      body: "Consider closing some losing positions before year-end to reduce your tax base.",
    });
  } else {
    result.push({
      title: "Loss settlement",
      body: "Keep full loss documentation and offset gains in the same or a future tax year.",
    });
  }

  if (params.dividends > 0) {
    result.push({
      title: "Dividend tax",
      body: `Review double-tax treaties for ${params.country} and prepare withholdings under ${params.taxName}.`,
    });
  }

  result.push({
    title: "Tax year plan",
    body: `Schedule gain and loss realization for ${params.taxYear} to avoid a tax spike at period end.`,
  });

  if (params.taxDue > 0) {
    result.push({
      title: "Account optimization",
      body: "Check whether tax-advantaged accounts can hold part of your long-term portfolio.",
    });
  }

  return result.slice(0, 4);
}

export function TaxOptimizerPage() {
  const { t } = useTranslation();
  const [userId] = useState<string>(() => readUserId());
  const [systems, setSystems] = useState<TaxSystemItem[]>([]);
  const [country, setCountry] = useState("PL");
  const [customRate, setCustomRate] = useState("19");
  const [grossGainsInput, setGrossGainsInput] = useState("");
  const [lossesInput, setLossesInput] = useState("");
  const [dividendsInput, setDividendsInput] = useState("0");
  const [taxYearInput, setTaxYearInput] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<TaxCalculateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryState | null>(null);

  const currentSystem = useMemo(
    () => systems.find((entry) => entry.code === country) ?? null,
    [country, systems],
  );

  const rateAsNumber = useMemo(() => {
    const parsed = Number.parseFloat(customRate.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [customRate]);
  const customRateValid = country !== "CUSTOM" || Number.isFinite(rateAsNumber);

  const fmt = useCallback(
    (n: number) => formatCurrency(n, data?.currency ?? currentSystem?.currency ?? "USD"),
    [currentSystem?.currency, data?.currency],
  );

  const loadSettingsAndSystems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [systemsResponse, settings] = await Promise.all([getTaxSystems(), getAlpacaSettings(userId)]);
      setSystems(systemsResponse);
      const savedCountry = String(settings.taxCountry ?? "").trim().toUpperCase();
      const resolvedCountry = savedCountry || "PL";
      setCountry(resolvedCountry);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const recalculate = useCallback(async () => {
    if (!country) return;
    setLoading(true);
    setError(null);
    try {
      const next = await calculateTax({
        userId,
        country,
        customRate: country === "CUSTOM" ? rateAsNumber : undefined,
      });
      setData(next);
      setGrossGainsInput(next.grossGains.toFixed(2));
      setLossesInput(next.losses.toFixed(2));
    } catch (e) {
      setData(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [country, rateAsNumber, userId]);

  useEffect(() => {
    void loadSettingsAndSystems();
  }, [loadSettingsAndSystems]);

  useEffect(() => {
    if (!systems.length) return;
    if (!customRateValid) {
      setData(null);
      setSummary(null);
      return;
    }
    void recalculate();
  }, [country, customRateValid, recalculate, systems.length]);

  useEffect(() => {
    setSummary(null);
  }, [country]);

  const persistCountry = useCallback(async () => {
    try {
      await saveAlpacaSettings({ userId, taxCountry: country });
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [country, userId]);

  const handleCalculate = useCallback(async () => {
    if (!customRateValid) {
      setError(t("taxOptimizer.customCountryRateInvalid"));
      return;
    }
    const source = data;
    if (!source) return;

    const gains = parseNumericInput(grossGainsInput, source.grossGains);
    const losses = parseNumericInput(lossesInput, source.losses);
    const dividends = parseNumericInput(dividendsInput, 0);
    const taxableBase = Math.max(0, gains - losses + dividends);
    const taxRate = source.taxRate;
    const estimatedTax = taxableBase * taxRate;
    const potentialSavings = Math.max(0, losses * taxRate * 0.45 + dividends * taxRate * 0.1);

    setSummary({
      taxDue: estimatedTax,
      potentialSavings,
      suggestions: buildOptimizationSuggestions({
        country,
        taxYear: taxYearInput || String(new Date().getFullYear()),
        losses,
        dividends,
        taxDue: estimatedTax,
        taxName: source.taxName,
      }),
    });
    await persistCountry();
  }, [country, customRateValid, data, dividendsInput, grossGainsInput, lossesInput, persistCountry, taxYearInput, t]);

  const titleCountryCode = (data?.country ?? country).toUpperCase();
  const countryName = TAX_COUNTRY_ENGLISH_NAMES[titleCountryCode] ?? titleCountryCode;
  const activeTaxRate = data?.taxRate ?? (country === "CUSTOM" && Number.isFinite(rateAsNumber) ? rateAsNumber / 100 : 0);

  return (
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={TERMINAL_TOOL_PAGE_INNER}>
      <header className={TERMINAL_TOOL_HERO}>
        <h1 className={TERMINAL_PAGE_TITLE}>{t("taxOptimizer.title", { defaultValue: "Tax Optimizer" })}</h1>
        <p className={`${TERMINAL_PAGE_SUBTITLE} mt-2`}>
          {t("taxOptimizer.pageSubtitle", {
            defaultValue: "Simulate tax scenarios for your portfolio and plan liabilities before year-end.",
          })}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {COUNTRY_PILLS.map((item) => {
            const active = country === item;
            const label = item === "CUSTOM" ? "Custom" : item;
            const systemName = systems.find((entry) => entry.code === item)?.name;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCountry(item)}
                className={active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                title={systemName || TAX_COUNTRY_ENGLISH_NAMES[item] || item}
              >
                {item === "CUSTOM" ? label : `${TAX_COUNTRY_FLAGS[item] ?? ""} ${label}`.trim()}
              </button>
            );
          })}
        </div>
      </header>

      <section className={TERMINAL_TOOL_PANEL}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("taxOptimizer.grossGains", { defaultValue: "Gains" })}
            </span>
            <input
              value={grossGainsInput}
              onChange={(event) => setGrossGainsInput(event.target.value)}
              inputMode="decimal"
              className={TERMINAL_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("taxOptimizer.losses", { defaultValue: "Losses" })}
            </span>
            <input
              value={lossesInput}
              onChange={(event) => setLossesInput(event.target.value)}
              inputMode="decimal"
              className={TERMINAL_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("taxOptimizer.dividends", { defaultValue: "Dividends" })}
            </span>
            <input
              value={dividendsInput}
              onChange={(event) => setDividendsInput(event.target.value)}
              inputMode="decimal"
              className={TERMINAL_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("taxOptimizer.year", { defaultValue: "Tax year" })}
            </span>
            <input
              value={taxYearInput}
              onChange={(event) => setTaxYearInput(event.target.value)}
              inputMode="numeric"
              className={TERMINAL_INPUT}
            />
          </label>
        </div>

        {country === "CUSTOM" && (
          <label className="mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
            <span className={TERMINAL_FORM_LABEL}>
              {t("tax.customRate", { defaultValue: "Custom tax rate (%)" })}
            </span>
            <input
              value={customRate}
              onChange={(event) => setCustomRate(event.target.value)}
              inputMode="decimal"
              className={TERMINAL_INPUT}
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => void handleCalculate()}
          disabled={loading || !data || !customRateValid}
          className={`${TERMINAL_BUTTON_PRIMARY} mt-5 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {loading ? t("common.loading") : t("taxOptimizer.calculate", { defaultValue: "Calculate" })}
        </button>
      </section>

      {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

      {summary && !error ? (
        <section className={TERMINAL_TOOL_PANEL}>
          <div className="grid gap-4 md:grid-cols-2">
            <article className={TERMINAL_TOOL_RESULT_CARD}>
              <p className="text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
                {t("taxOptimizer.toPay")}
              </p>
              <p className="mt-2 text-4xl font-bold text-terminal-negative">
                -{fmt(summary.taxDue)}
              </p>
            </article>

            <article className={TERMINAL_TOOL_RESULT_CARD}>
              <p className="text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
                {t("taxOptimizer.potentialSavings")}
              </p>
              <p className="mt-2 text-4xl font-bold text-terminal-positive">
                +{fmt(summary.potentialSavings)}
              </p>
            </article>
          </div>

          <div className="mt-5">
            <h2 className="text-lg font-semibold text-terminal-cyan">
              {t("taxOptimizer.suggestionsTitle")}
            </h2>
            <div className="mt-3 space-y-3">
              {summary.suggestions.map((suggestion) => (
                <article
                  key={suggestion.title}
                  className={`${TERMINAL_WARNING_PANEL} border-l-4 border-l-terminal-cyan`}
                >
                  <p className="text-sm font-semibold text-terminal-text">
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-sm text-terminal-textSecondary">
                    {suggestion.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs text-terminal-textMuted">
            {t("taxOptimizer.countryRateFooter", {
              country: countryName,
              rate: `${(activeTaxRate * 100).toFixed(2)}%`,
            })}
          </p>
        </section>
      ) : null}
      </div>
    </div>
  );
}
