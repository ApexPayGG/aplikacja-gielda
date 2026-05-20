import { useEffect, useMemo, useState } from "react";
import {
  evaluateReplayDecision,
  getReplaySnapshot,
  type ReplayAction,
  type ReplayEvaluateResponse,
  type ReplaySnapshotResponse,
  searchCompanies,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const SYMBOL_OPTIONS = ["PKN", "KGH", "PKO", "PZU", "PEO", "LPP", "CDR"];
const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
type ReplayDecision = ReplayAction | "SKIP";

function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function ReplayModePage() {
  const [symbolInput, setSymbolInput] = useState("PKN");
  const [symbolOptions, setSymbolOptions] = useState<string[]>(SYMBOL_OPTIONS);
  const [date, setDate] = useState("");
  const [snapshot, setSnapshot] = useState<ReplaySnapshotResponse | null>(null);
  const [reason, setReason] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<ReplayDecision | null>(null);
  const [evaluation, setEvaluation] = useState<ReplayEvaluateResponse | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxReplayDate = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const query = symbolInput.trim();
    if (!query) {
      setSymbolOptions(SYMBOL_OPTIONS);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoadingSymbols(true);
      try {
        const companies = await searchCompanies(query, 8);
        if (cancelled) return;
        const remoteSymbols = companies
          .map((row) => row.symbol?.trim().toUpperCase())
          .filter((item): item is string => Boolean(item));
        const merged = Array.from(
          new Set([query.toUpperCase(), ...remoteSymbols, ...SYMBOL_OPTIONS]),
        );
        setSymbolOptions(merged.slice(0, 12));
      } catch {
        if (!cancelled) {
          setSymbolOptions(Array.from(new Set([query.toUpperCase(), ...SYMBOL_OPTIONS])));
        }
      } finally {
        if (!cancelled) {
          setLoadingSymbols(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [symbolInput]);

  async function onLoadSnapshot(event: React.FormEvent) {
    event.preventDefault();
    const normalizedSymbol = symbolInput.trim().toUpperCase();
    if (!normalizedSymbol) {
      setError("Wpisz symbol spółki.");
      return;
    }

    setError(null);
    setEvaluation(null);
    setSelectedDecision(null);
    setReason("");
    setLoadingSnapshot(true);
    try {
      const next = await getReplaySnapshot(normalizedSymbol, date);
      setSnapshot(next);
    } catch (e) {
      setSnapshot(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingSnapshot(false);
    }
  }

  async function onDecide(decision: ReplayDecision) {
    if (!snapshot) return;
    setError(null);
    setSelectedDecision(decision);

    if (decision === "SKIP") {
      setEvaluation({
        score: 6,
        explanation:
          reason.trim().length > 0
            ? `Pominięcie zostało uzasadnione: ${reason.trim()}`
            : "Pominięcie może być dobrą decyzją, jeśli setup nie spełnia Twoich kryteriów.",
        actualOutcome: snapshot.priceChange5d,
      });
      return;
    }

    setLoadingEvaluation(true);
    try {
      const result = await evaluateReplayDecision({
        userId: USER_ID,
        symbol: snapshot.symbol,
        date: snapshot.date,
        action: decision,
        price: Number(snapshot.close),
      });
      setEvaluation(result);
    } catch (e) {
      setEvaluation(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoadingEvaluation(false);
    }
  }

  return (
    <div className="min-h-screen bg-bgSecondary">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-white">
        <header
          className="glass-section rounded-3xl p-6 shadow-[0_18px_45px_rgba(45,10,107,0.1)]"
          style={{ background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
        >
          <h1 className="glass-page-title text-3xl">Replay Mode</h1>
          <p className="mt-2 glass-muted text-sm">Cofnij się w czasie i zagraj &quot;co bym zrobił&quot;</p>
        </header>

        {error ? (
          <div className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">
            {error}
          </div>
        ) : null}

        <section className="glass-section rounded-2xl p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
          <form onSubmit={onLoadSnapshot} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium glass-muted">Symbol search</span>
              <input
                list="replay-symbols"
                type="search"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                placeholder="Wyszukaj spółkę..."
                className="rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
                required
              />
              <datalist id="replay-symbols">
                {symbolOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </datalist>
              <span className="text-xs text-white/50">{loadingSymbols ? "Szukam symboli..." : "Wpisz ticker lub nazwę"}</span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium glass-muted">Date picker</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={maxReplayDate}
                className="rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
                required
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loadingSnapshot}
                className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                style={{ backgroundColor: colors.brandDark }}
              >
                {loadingSnapshot ? "Ładowanie..." : "Załaduj historię"}
              </button>
            </div>
          </form>
        </section>

        {snapshot ? (
          <section className="grid gap-5 md:grid-cols-[1.45fr_1fr]">
            <article
              className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/10 p-6 text-center shadow-[0_14px_34px_rgba(45,10,107,0.08)]"
              style={{ backgroundColor: colors.bgSecondary }}
            >
              <div>
                <p className="text-sm font-medium text-white/50">Wykres historyczny</p>
                <p className="mt-2 text-xs text-white/50">
                  {snapshot.symbol} • {snapshot.date}
                </p>
              </div>
            </article>

            <aside className="glass-section rounded-2xl p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
              <p className="text-sm font-semibold glass-muted">Panel decyzji</p>
              <div className="mt-4 rounded-xl glass-panel border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase tracking-wide text-white/50">Cena na wybrany dzień</p>
                <p className="mt-1 font-mono text-2xl font-bold text-white">{formatPrice(snapshot.close)}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void onDecide("BUY")}
                  disabled={loadingEvaluation}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: colors.positive }}
                >
                  Kup
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide("SELL")}
                  disabled={loadingEvaluation}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  style={{ backgroundColor: colors.negative }}
                >
                  Sprzedaj
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide("SKIP")}
                  disabled={loadingEvaluation}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-bgSecondary disabled:opacity-60"
                  style={{ color: colors.textMuted }}
                >
                  Pomiń
                </button>
              </div>

              <label className="mt-4 block text-sm">
                <span className="font-medium glass-muted">Dlaczego?</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={5}
                  placeholder="Opisz swój tok myślenia..."
                  className="mt-1 w-full rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brandCyan focus:ring-2 focus:ring-brandCyan/20"
                />
              </label>

              {loadingEvaluation ? <p className="mt-3 text-xs text-white/50">Analiza decyzji...</p> : null}
            </aside>
          </section>
        ) : null}

        {evaluation ? (
          <section
            className="rounded-2xl p-5 text-white shadow-[0_18px_45px_rgba(45,10,107,0.35)]"
            style={{ background: `linear-gradient(120deg, ${colors.brandDark}, ${colors.brandMedium})` }}
          >
            <h2 className="text-lg font-semibold text-white">AI Feedback</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <p>
                <span className="text-white/70">Decyzja:</span>{" "}
                <span className="font-semibold">
                  {selectedDecision === "BUY" ? "Kup" : selectedDecision === "SELL" ? "Sprzedaj" : "Pomiń"}
                </span>
              </p>
              <p>
                <span className="text-white/70">Score:</span> <span className="font-semibold">{evaluation.score}/10</span>
              </p>
              <p>
                <span className="text-white/70">Faktyczny wynik:</span>{" "}
                <span className="font-semibold">
                  {evaluation.actualOutcome >= 0 ? "+" : ""}
                  {evaluation.actualOutcome.toFixed(2)}%
                </span>
              </p>
            </div>
            <p className="mt-2 text-sm text-white/90">{evaluation.explanation}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
