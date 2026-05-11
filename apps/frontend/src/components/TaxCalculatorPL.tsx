import { useState } from "react";
import { useTranslation } from "react-i18next";

const DIVIDEND_TAX_BY_LOCALE: Record<string, { rate: number; name: string }> = {
  pl: { rate: 0.19, name: "Podatek Belki (PIT 19%)" },
  de: { rate: 0.26375, name: "Abgeltungssteuer (26,375%)" },
  fr: { rate: 0.3, name: "PFU - Flat Tax (30%)" },
  es: { rate: 0.19, name: "Impuesto dividendos (19%)" },
  en: { rate: 0.0875, name: "Dividend Tax (8.75%)" },
  ja: { rate: 0.20315, name: "配当課税 (20.315%)" },
  hi: { rate: 0.1, name: "Dividend Tax (10%)" },
  ko: { rate: 0.154, name: "배당소득세 (15.4%)" },
  "zh-TW": { rate: 0.21, name: "股利所得稅 (21%)" },
};

function resolveTaxConfig(lang: string): { rate: number; name: string; key: string } {
  const normalized = (lang || "").trim();
  if (normalized === "zh-TW") return { ...DIVIDEND_TAX_BY_LOCALE["zh-TW"], key: "zh-TW" };
  const base = normalized.split("-")[0];
  if (base in DIVIDEND_TAX_BY_LOCALE) {
    return { ...DIVIDEND_TAX_BY_LOCALE[base], key: base };
  }
  return { ...DIVIDEND_TAX_BY_LOCALE.en, key: "en" };
}

export function TaxCalculatorPL() {
  const { t, i18n } = useTranslation();
  const [shares, setShares] = useState("100");
  const [price, setPrice] = useState("180");
  const [dps, setDps] = useState("1.0");
  const [yieldPct, setYieldPct] = useState("");
  const [result, setResult] = useState<{
    grossDividend: number;
    taxAmount: number;
    netIncome: number;
    taxRate: number;
    method: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taxConfig = resolveTaxConfig(i18n.resolvedLanguage || i18n.language || "en");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const sharesNum = parseFloat(shares);
    const priceNum = parseFloat(price);
    const dpsNum = parseFloat(dps);
    const yieldNum = parseFloat(yieldPct);

    if (!Number.isFinite(sharesNum) || sharesNum < 0 || !Number.isFinite(priceNum) || priceNum < 0) {
      setResult(null);
      setError(t("common.error", { defaultValue: "Error" }));
      return;
    }

    const useYield = yieldPct.trim() !== "" && Number.isFinite(yieldNum) && yieldNum >= 0;
    const grossDividend = useYield
      ? sharesNum * priceNum * (yieldNum / 100)
      : sharesNum * (Number.isFinite(dpsNum) && dpsNum >= 0 ? dpsNum : 0);

    const effectiveRate = taxConfig.key === "hi" && grossDividend <= 5000 ? 0 : taxConfig.rate;
    const taxAmount = grossDividend * effectiveRate;
    const netIncome = grossDividend - taxAmount;

    setResult({
      grossDividend,
      taxAmount,
      netIncome,
      taxRate: effectiveRate,
      method: useYield ? "yield_pct" : "dividend_per_share",
    });
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated/50 p-6">
      <h3 className="text-lg font-semibold text-white">{taxConfig.name}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {t("dividend.taxSubtitle", { defaultValue: "Net = gross - (gross × tax rate)." })}
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">{t("dividend.taxShares", { defaultValue: "Number of shares" })}</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">{t("dividend.taxReferencePrice", { defaultValue: "Price (reference)" })}</span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">
            {t("dividend.taxAnnualDividendPerShare", { defaultValue: "Annual dividend / share" })}
          </span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={dps}
            onChange={(e) => setDps(e.target.value)}
            type="number"
            min={0}
            step="any"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">
            {t("dividend.taxYieldAlternative", { defaultValue: "Alternative: annual yield % (optional)" })}
          </span>
          <input
            className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-white"
            value={yieldPct}
            onChange={(e) => setYieldPct(e.target.value)}
            type="number"
            min={0}
            step="any"
            placeholder={t("dividend.taxYieldPlaceholder", { defaultValue: "e.g. 2.5" })}
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {t("dividend.taxCalculate", { defaultValue: "Calculate" })}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result && (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <dt className="text-slate-500">{t("dividend.taxMethod", { defaultValue: "Method" })}</dt>
          <dd className="text-slate-200">{result.method === "yield_pct" ? "yield %" : "DPS"}</dd>
          <dt className="text-slate-500">{t("dividend.taxGrossDividend", { defaultValue: "Gross dividend" })}</dt>
          <dd className="font-mono text-white">{result.grossDividend.toFixed(2)}</dd>
          <dt className="text-slate-500">
            {t("dividend.taxRateLabel", {
              defaultValue: "Tax ({{rate}}%)",
              rate: (result.taxRate * 100).toFixed(3),
            })}
          </dt>
          <dd className="font-mono text-white">{result.taxAmount.toFixed(2)}</dd>
          <dt className="text-slate-500">{t("dividend.taxNet", { defaultValue: "Net" })}</dt>
          <dd className="font-mono text-accent">{result.netIncome.toFixed(2)}</dd>
        </dl>
      )}
    </div>
  );
}
