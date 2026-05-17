import { useCallback, useEffect, useMemo, useState } from "react";
import { TAX_COUNTRY_ENGLISH_NAMES, TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
import {
  calculateTax,
  getAlpacaSettings,
  getTaxSystems,
  saveAlpacaSettings,
  type TaxCalculateResponse,
  type TaxSystemItem,
} from "../services/api";
import { colors } from "../styles/designSystem";
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
      title: "Harvesting strat",
      body: "Rozważ zamknięcie części stratnych pozycji przed końcem roku, aby obniżyć podstawę opodatkowania.",
    });
  } else {
    result.push({
      title: "Rozliczenie strat",
      body: "Zachowaj pełną dokumentację strat i rozlicz je z zyskami w tym samym lub kolejnym roku podatkowym.",
    });
  }

  if (params.dividends > 0) {
    result.push({
      title: "Podatek od dywidend",
      body: `Zweryfikuj umowy o unikaniu podwójnego opodatkowania dla kraju ${params.country} i przygotuj potrącenia pod ${params.taxName}.`,
    });
  }

  result.push({
    title: "Plan na rok podatkowy",
    body: `Ustal harmonogram realizacji zysków i strat na ${params.taxYear}, aby uniknąć kumulacji podatku na koniec okresu.`,
  });

  if (params.taxDue > 0) {
    result.push({
      title: "Optymalizacja rachunków",
      body: "Sprawdź możliwość wykorzystania rachunków uprzywilejowanych podatkowo dla części portfela długoterminowego.",
    });
  }

  return result.slice(0, 4);
}

export function TaxOptimizerPage() {
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
      setError("Wprowadź poprawną stawkę dla trybu Custom.");
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
  }, [country, customRateValid, data, dividendsInput, grossGainsInput, lossesInput, persistCountry, taxYearInput]);

  const titleCountryCode = (data?.country ?? country).toUpperCase();
  const countryName = TAX_COUNTRY_ENGLISH_NAMES[titleCountryCode] ?? titleCountryCode;
  const activeTaxRate = data?.taxRate ?? (country === "CUSTOM" && Number.isFinite(rateAsNumber) ? rateAsNumber / 100 : 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header
        className="rounded-3xl border p-6 shadow-[0_20px_44px_rgba(45,10,107,0.12)]"
        style={{
          borderColor: colors.border,
          background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})`,
        }}
      >
        <h1 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
          Optymalizator podatkowy
        </h1>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          Symuluj scenariusze podatkowe dla portfela i zaplanuj obciążenia zanim zamkniesz rok.
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
                className="rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition"
                style={{
                  borderColor: active ? colors.brandDark : colors.borderStrong,
                  backgroundColor: active ? colors.brandDark : colors.bgPrimary,
                  color: active ? colors.bgPrimary : colors.textSecondary,
                }}
                title={systemName || TAX_COUNTRY_ENGLISH_NAMES[item] || item}
              >
                {item === "CUSTOM" ? label : `${TAX_COUNTRY_FLAGS[item] ?? ""} ${label}`.trim()}
              </button>
            );
          })}
        </div>
      </header>

      <section className="rounded-2xl border p-5 shadow-[0_14px_32px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Zyski
            </span>
            <input
              value={grossGainsInput}
              onChange={(event) => setGrossGainsInput(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Straty
            </span>
            <input
              value={lossesInput}
              onChange={(event) => setLossesInput(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Dywidendy
            </span>
            <input
              value={dividendsInput}
              onChange={(event) => setDividendsInput(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Rok podatkowy
            </span>
            <input
              value={taxYearInput}
              onChange={(event) => setTaxYearInput(event.target.value)}
              inputMode="numeric"
              className="rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            />
          </label>
        </div>

        {country === "CUSTOM" && (
          <label className="mt-4 flex max-w-xs flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Custom rate (%)
            </span>
            <input
              value={customRate}
              onChange={(event) => setCustomRate(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => void handleCalculate()}
          disabled={loading || !data || !customRateValid}
          className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
        >
          {loading ? "Ładowanie..." : "Oblicz"}
        </button>
      </section>

      {error ? (
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: `${colors.negative}66`, color: colors.negative, backgroundColor: `${colors.negative}14` }}>
          {error}
        </div>
      ) : null}

      {summary && !error ? (
        <section className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                Podatek należny
              </p>
              <p className="mt-2 text-4xl font-bold" style={{ color: colors.negative }}>
                -{fmt(summary.taxDue)}
              </p>
            </article>

            <article className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
                Potencjalna oszczędność
              </p>
              <p className="mt-2 text-4xl font-bold" style={{ color: colors.positive }}>
                +{fmt(summary.potentialSavings)}
              </p>
            </article>
          </div>

          <div className="mt-5">
            <h2 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
              Sugestie optymalizacji
            </h2>
            <div className="mt-3 space-y-3">
              {summary.suggestions.map((suggestion) => (
                <article
                  key={suggestion.title}
                  className="rounded-xl border p-4"
                  style={{ borderColor: colors.border, borderLeft: `4px solid ${colors.brandCyan}`, backgroundColor: colors.bgPrimary }}
                >
                  <p className="text-sm font-semibold" style={{ color: colors.brandDark }}>
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                    {suggestion.body}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <p className="mt-5 text-xs" style={{ color: colors.textMuted }}>
            Kraj: {countryName} • Efektywna stawka: {(activeTaxRate * 100).toFixed(2)}%
          </p>
        </section>
      ) : null}
    </div>
  );
}
