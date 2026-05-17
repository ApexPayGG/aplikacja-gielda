import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { runPreMortem, type PreMortemResponse } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
const PLN_PER_USD = 3.95;

const HORIZON_OPTIONS = [
  { months: 3, label: "3 miesiace", riskPct: 0.08, rewardPct: 0.15 },
  { months: 6, label: "6 miesiecy", riskPct: 0.12, rewardPct: 0.24 },
  { months: 12, label: "12 miesiecy", riskPct: 0.18, rewardPct: 0.35 },
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function pickHorizon(months: number) {
  return HORIZON_OPTIONS.find((option) => option.months === months) ?? HORIZON_OPTIONS[1];
}

export function PreMortemPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    ticker: "",
    entryPrice: "",
    quantity: "1",
    horizonMonths: 6,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreMortemResponse | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    const symbol = searchParams.get("symbol");
    const entry = searchParams.get("entry");
    const quantity = searchParams.get("quantity");
    const horizon = Number(searchParams.get("horizonMonths"));
    const regime = searchParams.get("regime");
    if (symbol || entry || quantity || Number.isFinite(horizon)) {
      setForm((prev) => ({
        ticker: symbol?.trim().toUpperCase() || prev.ticker,
        entryPrice: entry != null && entry !== "" ? entry : prev.entryPrice,
        quantity: quantity != null && quantity !== "" ? quantity : prev.quantity,
        horizonMonths: HORIZON_OPTIONS.some((option) => option.months === horizon)
          ? horizon
          : prev.horizonMonths,
      }));
    }
    setPrefillNote(regime ? `Tryb rynkowy z prefilla: ${regime}` : null);
  }, [searchParams]);

  const selectedHorizon = useMemo(() => pickHorizon(form.horizonMonths), [form.horizonMonths]);

  const projectedGain = useMemo(() => {
    if (!result) return 0;
    const multiplier = selectedHorizon.rewardPct / selectedHorizon.riskPct;
    return Math.abs(result.maxLoss) * multiplier;
  }, [result, selectedHorizon.riskPct, selectedHorizon.rewardPct]);

  const aiNarrative = useMemo(() => {
    if (!result) return "";
    return `AI ocenia, ze dla ${form.ticker || "wybranego waloru"} rynek (${result.marketRegime}) moze najpierw wygenerowac zmiennosc, dlatego zalecana jest dyscyplina planu dla horyzontu ${selectedHorizon.label}.`;
  }, [form.ticker, result, selectedHorizon.label]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const entry = Number(form.entryPrice);
    const quantity = Number(form.quantity);
    if (!form.ticker.trim() || !Number.isFinite(entry) || entry <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Uzupelnij poprawnie wszystkie pola formularza.");
      return;
    }

    const stopLoss = entry * (1 - selectedHorizon.riskPct);
    const takeProfit = entry * (1 + selectedHorizon.rewardPct);
    setLoading(true);
    setError(null);
    try {
      const response = await runPreMortem({
        symbol: form.ticker.trim().toUpperCase(),
        entry,
        stopLoss,
        takeProfit,
        quantity,
        userId: USER_ID,
      });
      setResult(response);
    } catch (e) {
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
            Pre-Mortem AI
          </h1>
          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Zanim wejdziesz w pozycje, przetestuj scenariusz straty i potencjalny upside.
          </p>
        </header>

        {prefillNote ? (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: colors.borderStrong,
              backgroundColor: colors.bgPrimary,
              color: colors.textSecondary,
            }}
          >
            {prefillNote}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border p-6 shadow-sm"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold" style={{ color: colors.textSecondary }}>
                Ticker
              </span>
              <input
                value={form.ticker}
                onChange={(event) => setForm((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))}
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
                Entry price
              </span>
              <input
                type="number"
                step="0.01"
                value={form.entryPrice}
                onChange={(event) => setForm((prev) => ({ ...prev, entryPrice: event.target.value }))}
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
                Ilosc
              </span>
              <input
                type="number"
                step="1"
                min="1"
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
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
                Horyzont
              </span>
              <select
                value={form.horizonMonths}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, horizonMonths: Number(event.target.value) }))
                }
                className="rounded-xl border px-3 py-2 outline-none"
                style={{
                  borderColor: colors.borderStrong,
                  backgroundColor: colors.bgPrimary,
                  color: colors.textPrimary,
                }}
              >
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option.months} value={option.months}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{
              background: `linear-gradient(90deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
            }}
          >
            {loading ? "Analiza..." : "Analizuj ryzyko"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 text-sm" style={{ color: colors.negative }}>
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <article
                className="rounded-2xl border p-5"
                style={{ borderColor: colors.negative, backgroundColor: colors.bgPrimary }}
              >
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  Scenariusz straty
                </p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.textPrimary }}>
                  {result.scenario}
                </p>
                <p className="mt-3 text-sm font-semibold" style={{ color: colors.negative }}>
                  Max loss: {formatCurrency(Math.abs(result.maxLoss))}
                </p>
              </article>

              <article
                className="rounded-2xl border p-5 text-center"
                style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
              >
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  Prawdopodobienstwo
                </p>
                <p className="mt-3 text-5xl font-extrabold" style={{ color: colors.brandGold }}>
                  {result.probability}%
                </p>
              </article>

              <article
                className="rounded-2xl border p-5"
                style={{ borderColor: colors.positive, backgroundColor: colors.bgPrimary }}
              >
                <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
                  Scenariusz zysku
                </p>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.textPrimary }}>
                  Przy zachowaniu planu potencjalny upside dla horyzontu {selectedHorizon.label} moze
                  osiagnac ok. {formatCurrency(projectedGain)}.
                </p>
                <p className="mt-3 text-sm font-semibold" style={{ color: colors.positive }}>
                  Regime: {result.marketRegime}
                </p>
              </article>
            </div>

            <article
              className="rounded-2xl p-6 text-white shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${colors.brandDark} 0%, ${colors.brandMedium} 100%)`,
              }}
            >
              <p className="text-xs uppercase tracking-wide text-white/80">AI narrative</p>
              <p className="mt-3 text-sm leading-relaxed">{aiNarrative}</p>
              <p className="mt-4 text-xs text-white/80">
                Loss benchmark: {formatCurrency(Math.abs(result.maxLoss))} (~
                {(Math.abs(result.maxLoss) / PLN_PER_USD).toFixed(2)} USD)
              </p>
            </article>
          </section>
        ) : null}
      </div>
    </div>
  );
}
