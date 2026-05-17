import { FormEvent, useMemo, useState } from "react";
import {
  getEarningsPrediction,
  type EarningsPredictionLabel,
  type EarningsPredictionResponse,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

function predictionBadgeStyle(prediction: EarningsPredictionLabel): { backgroundColor: string; color: string; borderColor: string } {
  if (prediction === "BEAT") {
    return { backgroundColor: `${colors.positive}1F`, color: colors.positive, borderColor: `${colors.positive}66` };
  }
  if (prediction === "MISS") {
    return { backgroundColor: `${colors.negative}1F`, color: colors.negative, borderColor: `${colors.negative}66` };
  }
  return { backgroundColor: colors.bgSecondary, color: colors.textSecondary, borderColor: colors.borderStrong };
}

function predictionLabel(prediction: EarningsPredictionLabel): string {
  return prediction === "IN_LINE" ? "IN-LINE" : prediction;
}

type FactorItem = {
  name: string;
  impact: number;
};

type HistoryRow = {
  quarter: string;
  prediction: string;
  accuracy: number;
};

function buildFactors(result: EarningsPredictionResponse): FactorItem[] {
  const base = Math.min(95, Math.max(45, result.confidence));
  const direction = result.prediction === "MISS" ? -1 : 1;
  const seed = result.symbol
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const offsets = [11, -7, 4, -12, 8];
  const names = [
    "Revenue momentum",
    "EPS revisions",
    "Guidance quality",
    "Macro sensitivity",
    "Options sentiment",
  ];

  return names.map((name, index) => {
    const wobble = ((seed + index * 13) % 9) - 4;
    const raw = base + direction * offsets[index] + wobble;
    return { name, impact: Math.max(20, Math.min(96, Math.round(raw))) };
  });
}

function buildHistory(result: EarningsPredictionResponse): HistoryRow[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  const quarter = Math.max(1, Math.ceil((now.getMonth() + 1) / 3));
  const base = Math.min(97, Math.max(55, result.confidence));
  const labels: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const offsetQuarter = quarter - index;
    const normalizedQuarter = offsetQuarter > 0 ? offsetQuarter : 4 + offsetQuarter;
    const yearShift = offsetQuarter > 0 ? 0 : 1;
    labels.push(`Q${normalizedQuarter} ${thisYear - yearShift}`);
  }

  return labels.map((label, index) => ({
    quarter: label,
    prediction: predictionLabel(result.prediction),
    accuracy: Math.max(52, Math.min(98, Math.round(base - index * 4 + (index % 2 === 0 ? 3 : -2)))),
  }));
}

export function EarningsPredictorPage() {
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EarningsPredictionResponse | null>(null);

  const factors = useMemo(() => (result ? buildFactors(result) : []), [result]);
  const historyRows = useMemo(() => (result ? buildHistory(result) : []), [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = symbolInput.trim().toUpperCase();
    if (!symbol) {
      setError("Wpisz ticker spółki.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getEarningsPrediction(symbol);
      setResult(next);
    } catch (e) {
      setResult(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header
        className="rounded-3xl border p-6 shadow-[0_18px_44px_rgba(45,10,107,0.1)]"
        style={{ borderColor: colors.border, background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <h1 className="text-3xl font-bold" style={{ color: colors.brandDark }}>
          Earnings Surprise Predictor
        </h1>
        <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
          Model przewiduje kierunek zaskoczenia wynikowego i wskazuje czynniki wpływu dla najbliższego raportu.
        </p>
      </header>

      <section className="rounded-2xl border p-6 shadow-[0_12px_30px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 md:flex-row">
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="Search spółki (np. MSFT)"
            className="w-full rounded-xl border px-4 py-2 outline-none"
            style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
            maxLength={16}
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-5 py-2 font-semibold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            {loading ? "Ładowanie..." : "Predict"}
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: `${colors.negative}66`, color: colors.negative, backgroundColor: `${colors.negative}12` }}>
          {error}
        </div>
      ) : null}

      {!loading && !error && result ? (
        <section className="space-y-6 rounded-2xl border p-6 shadow-[0_14px_34px_rgba(45,10,107,0.08)]" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <article className="flex flex-col items-center justify-center rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
              <div
                className="flex h-44 w-44 flex-col items-center justify-center rounded-full text-center text-white shadow-[0_14px_28px_rgba(45,10,107,0.35)]"
                style={{ backgroundColor: colors.brandDark }}
              >
                <p className="text-xs uppercase tracking-wide text-white/80">Prediction score</p>
                <p className="mt-1 text-5xl font-bold">{Math.round(result.confidence)}</p>
                <p className="text-sm font-semibold">/100</p>
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: colors.textSecondary }}>
                {result.symbol} • {result.nextEarningsDate ?? "Data TBA"}
              </p>
              <span
                className="mt-3 rounded-full border px-4 py-1.5 text-sm font-bold tracking-wide"
                style={predictionBadgeStyle(result.prediction)}
              >
                {predictionLabel(result.prediction)}
              </span>
            </article>

            <article className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
              <h2 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
                Factors impact
              </h2>
              <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                Symulowane czynniki na bazie confidence score.
              </p>
              <ul className="mt-4 space-y-3">
                {factors.map((factor) => (
                  <li key={factor.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span style={{ color: colors.textPrimary }}>{factor.name}</span>
                      <span className="font-semibold" style={{ color: colors.brandDark }}>
                        {factor.impact}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
                      <div className="h-full rounded-full" style={{ width: `${factor.impact}%`, backgroundColor: colors.brandCyan }} />
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          <article className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgSecondary }}>
            <h3 className="text-lg font-semibold" style={{ color: colors.brandDark }}>
              Historia predykcji
            </h3>
            <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
              Symulowana historia skuteczności modelu.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border" style={{ borderColor: colors.border }}>
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}>
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Okres</th>
                    <th className="px-4 py-2.5 font-semibold">Prediction</th>
                    <th className="px-4 py-2.5 font-semibold">Accuracy %</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.quarter} className="border-t" style={{ borderColor: colors.border }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: colors.textPrimary }}>
                        {row.quarter}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: colors.textSecondary }}>
                        {row.prediction}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: colors.brandDark }}>
                        {row.accuracy}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              {result.reasoning}
            </p>
          </article>
        </section>
      ) : null}
    </div>
  );
}
