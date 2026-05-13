import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_COUNTRY_ENGLISH_NAMES, TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
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

function readUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  const fromStorage = window.localStorage.getItem("userId")?.trim();
  return fromStorage || DEFAULT_USER_ID;
}

export function TaxOptimizerPage() {
  const { t, i18n } = useTranslation();
  const [userId] = useState<string>(() => readUserId());
  const [systems, setSystems] = useState<TaxSystemItem[]>([]);
  const [country, setCountry] = useState("PL");
  const [customRate, setCustomRate] = useState("19");
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [data, setData] = useState<TaxCalculateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const currentSystem = useMemo(
    () => systems.find((entry) => entry.code === country) ?? null,
    [country, systems],
  );

  const rateAsNumber = useMemo(() => {
    const parsed = Number.parseFloat(customRate.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [customRate]);

  const fmt = useCallback(
    (n: number) => formatCurrency(n, data?.currency ?? currentSystem?.currency ?? "USD"),
    [currentSystem?.currency, data?.currency],
  );
  const dateLocale = i18n.language.replace(/_/g, "-");

  const loadSettingsAndSystems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [systemsResponse, settings] = await Promise.all([getTaxSystems(), getAlpacaSettings(userId)]);
      setSystems(systemsResponse);
      const savedCountry = String(settings.taxCountry ?? "").trim().toUpperCase();
      const resolvedCountry = savedCountry || "PL";
      setCountry(resolvedCountry);
      setShowCountrySelector(!savedCountry);
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
    if (country === "CUSTOM" && !Number.isFinite(rateAsNumber)) return;
    void recalculate();
  }, [country, rateAsNumber, recalculate, systems.length]);

  const persistCountry = useCallback(async () => {
    setSettingsSaving(true);
    setSettingsNotice(null);
    try {
      await saveAlpacaSettings({ userId, taxCountry: country });
      setSettingsNotice(t("common.save"));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSettingsSaving(false);
    }
  }, [country, t, userId]);

  const taxName = data?.taxName ?? currentSystem?.cgt.name ?? "CGT";
  const titleCountryCode = (data?.country ?? country).toUpperCase();
  const countryName = TAX_COUNTRY_ENGLISH_NAMES[titleCountryCode] ?? titleCountryCode;
  const zeroTax = data?.taxRate === 0;
  const showUsNote = country === "US";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {t("tax.title")} — {countryName}
            </h1>
            <p className="mt-2 max-w-2xl text-xs text-slate-500">{t("money.gpwCaption")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCountrySelector((v) => !v)}
            className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-brand-blue"
          >
            {t("tax.changeCountry")}
          </button>
        </div>

        {(showCountrySelector || !data) && (
          <div className="neo-panel grid gap-3 rounded-xl border border-white/5 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("tax.selectCountry")}
              </span>
              <select
                value={country}
                onChange={(e) => setCountry(String(e.target.value).toUpperCase())}
                className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
              >
                {systems.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {`${TAX_COUNTRY_FLAGS[entry.code] ?? ""} ${entry.name}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void persistCountry()}
              disabled={settingsSaving}
              className="rounded-lg border border-brand-blue/60 bg-brand-blue/10 px-4 py-2 text-sm text-brand-blue transition hover:bg-brand-blue/20 disabled:opacity-60"
            >
              {settingsSaving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        )}

        {country === "CUSTOM" && (
          <label className="flex max-w-xs flex-col gap-1 text-sm text-slate-300">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("tax.customRate")}
            </span>
            <input
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              inputMode="decimal"
              placeholder="19"
              className="rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-white outline-none focus:border-brand-blue"
            />
          </label>
        )}
      </header>

      {settingsNotice && <p className="mb-4 text-xs text-brand-green">{settingsNotice}</p>}
      {loading && <p className="text-slate-400">{t("common.loading")}</p>}
      {error && <p className="text-sm text-brand-red">{error}</p>}

      {!loading && !error && data && (
        <>
          {zeroTax && (
            <div className="mb-5 rounded-xl border border-brand-green/40 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
              {country === "TW" ? "No CGT on listed stocks in Taiwan" : t("tax.noTax")}
            </div>
          )}

          {showUsNote && data.note && (
            <div className="mb-5 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3 text-sm text-brand-blue">
              {data.note}
            </div>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">GROSS GAINS</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-green">
                {fmt(data.grossGains)}
              </div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">LOSSES</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-red">{fmt(data.losses)}</div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">NET INCOME</div>
              <div
                className={`mt-2 font-mono text-xl font-semibold ${data.netIncome >= 0 ? "text-brand-green" : "text-brand-red"}`}
              >
                {data.netIncome < 0 ? "-" : ""}
                {fmt(Math.abs(data.netIncome))}
              </div>
            </div>
            <div className="neo-panel rounded-xl border border-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{taxName}</div>
              <div className="mt-2 font-mono text-xl font-semibold text-brand-amber">
                {(data.taxRate * 100).toFixed(2)}%
              </div>
              <div className="mt-1 text-[10px] text-slate-500">{data.form}</div>
            </div>
            <div className="neo-panel rounded-xl border border-brand-amber/30 bg-brand-amber/5 p-4 sm:col-span-2 lg:col-span-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">TAX DUE</div>
              <div className="mt-2 font-mono text-2xl font-bold text-brand-amber">{fmt(data.taxDue)}</div>
            </div>
          </div>

          <section className="neo-panel overflow-x-auto rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("taxOptimizer.closedTrades")}</h2>
            {data.trades.length === 0 ? (
              <p className="text-sm text-slate-500">{t("taxOptimizer.noTrades")}</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">{t("taxOptimizer.colTicker")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colOpen")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colClose")}</th>
                    <th className="py-2 pr-4">{t("taxOptimizer.colPnl")}</th>
                    <th className="py-2">{t("taxOptimizer.colPct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((r, idx) => (
                    <tr
                      key={`${r.ticker}-${r.closeDate}-${idx}`}
                      className="border-b border-white/5 font-mono text-slate-200"
                    >
                      <td className="py-2 pr-4 font-semibold text-white">{r.ticker}</td>
                      <td className="py-2 pr-4 text-xs text-slate-400">
                        {new Date(r.openDate).toLocaleDateString(dateLocale)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-400">
                        {new Date(r.closeDate).toLocaleDateString(dateLocale)}
                      </td>
                      <td className={`py-2 pr-4 ${r.pnl >= 0 ? "text-brand-green" : "text-brand-red"}`}>
                        {fmt(r.pnl)}
                      </td>
                      <td className={`py-2 ${r.pnlPct >= 0 ? "text-brand-green" : "text-brand-red"}`}>
                        {r.pnlPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="mt-8 text-xs leading-relaxed text-slate-500">{t("tax.disclaimer")}</p>
        </>
      )}
    </div>
  );
}
