import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type MarketCode = "US" | "PL" | "DE" | "JP";
type SignalKind = "CRITICAL" | "STANDARD" | "RESEARCH";
type MarketRegime = "TRENDING" | "RANGING" | "RISK_ON" | "RISK_OFF";
type NarrativeConfidence = "HIGH" | "MEDIUM" | "LOW";

type SignalListItem = {
  id: string;
  ticker: string;
  market: MarketCode;
  riskScore: number;
  setupType: string;
  marketRegime: MarketRegime;
  changePct: number;
  signalType: SignalKind;
  price: number;
  winRate: number;
  avgReturn: number;
  maxDrawdown: number;
  totalSignals: number;
};

type NarrativeData = {
  headline: string;
  body: string;
  riskNote: string;
  confidence: NarrativeConfidence;
};

type DnaMatch = {
  id: string;
  similarityPct: number;
  date: string;
  outcome: string;
};

type DnaData = {
  matches: DnaMatch[];
};

const marketFlags: Record<MarketCode, string> = {
  US: "🇺🇸",
  PL: "🇵🇱",
  DE: "🇩🇪",
  JP: "🇯🇵",
};

const mockSignals: SignalListItem[] = [
  {
    id: "sig-1001",
    ticker: "AAPL",
    market: "US",
    riskScore: 86,
    setupType: "Breakout above VWAP",
    marketRegime: "TRENDING",
    changePct: 2.4,
    signalType: "CRITICAL",
    price: 192.41,
    winRate: 71,
    avgReturn: 3.2,
    maxDrawdown: -4.8,
    totalSignals: 56,
  },
  {
    id: "sig-1002",
    ticker: "PKN",
    market: "PL",
    riskScore: 64,
    setupType: "Mean reversion to EMA20",
    marketRegime: "RANGING",
    changePct: -0.8,
    signalType: "STANDARD",
    price: 69.2,
    winRate: 58,
    avgReturn: 1.7,
    maxDrawdown: -5.6,
    totalSignals: 38,
  },
  {
    id: "sig-1003",
    ticker: "SAP",
    market: "DE",
    riskScore: 79,
    setupType: "Volume squeeze expansion",
    marketRegime: "RISK_ON",
    changePct: 1.1,
    signalType: "STANDARD",
    price: 184.5,
    winRate: 63,
    avgReturn: 2.4,
    maxDrawdown: -6.1,
    totalSignals: 44,
  },
  {
    id: "sig-1004",
    ticker: "7203",
    market: "JP",
    riskScore: 55,
    setupType: "Failed breakout reversal",
    marketRegime: "RISK_OFF",
    changePct: -2.1,
    signalType: "RESEARCH",
    price: 3280,
    winRate: 49,
    avgReturn: 0.9,
    maxDrawdown: -8.9,
    totalSignals: 28,
  },
  {
    id: "sig-1005",
    ticker: "MSFT",
    market: "US",
    riskScore: 82,
    setupType: "Momentum continuation",
    marketRegime: "TRENDING",
    changePct: 1.8,
    signalType: "CRITICAL",
    price: 428.3,
    winRate: 69,
    avgReturn: 2.9,
    maxDrawdown: -4.2,
    totalSignals: 61,
  },
];

const mockNarrative = (signal: SignalListItem): NarrativeData => ({
  headline: `${signal.ticker} setup: ${signal.setupType}`,
  body: `Momentum profile for ${signal.ticker} aligns with ${signal.marketRegime}. Price and volume action suggest continuation potential with controlled downside if invalidation level is respected.`,
  riskNote: "Wait for candle close confirmation and keep strict stop discipline.",
  confidence: signal.riskScore >= 80 ? "HIGH" : signal.riskScore >= 60 ? "MEDIUM" : "LOW",
});

const mockDna = (signal: SignalListItem): DnaData => ({
  matches: [
    { id: `${signal.id}-m1`, similarityPct: 92, date: "2026-04-21", outcome: "+4.6%" },
    { id: `${signal.id}-m2`, similarityPct: 88, date: "2026-03-13", outcome: "+2.1%" },
    { id: `${signal.id}-m3`, similarityPct: 84, date: "2026-01-29", outcome: "-1.0%" },
  ],
});

function isEndpointMissing(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 404;
}

function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function riskScoreColor(score: number): string {
  if (score >= 80) return "text-[#00c87a]";
  if (score >= 60) return "text-[#0096ff]";
  return "text-[#ff4a4a]";
}

function typeBadgeClass(type: SignalKind): string {
  if (type === "CRITICAL") return "bg-[#00c87a]/15 text-[#00c87a] border border-[#00c87a]/30";
  if (type === "STANDARD") return "bg-[#0096ff]/15 text-[#0096ff] border border-[#0096ff]/30";
  return "bg-[#ff4a4a]/15 text-[#ff4a4a] border border-[#ff4a4a]/30";
}

function regimeBadgeClass(regime: MarketRegime): string {
  if (regime === "TRENDING") return "bg-[#00c87a]/15 text-[#00c87a]";
  if (regime === "RANGING") return "bg-slate-500/25 text-slate-200";
  if (regime === "RISK_ON") return "bg-[#0096ff]/15 text-[#0096ff]";
  return "bg-[#ff4a4a]/15 text-[#ff4a4a]";
}

function parseSignal(raw: unknown): SignalListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "").trim();
  const ticker = String(r.ticker ?? r.symbol ?? "").trim().toUpperCase();
  if (!id || !ticker) return null;
  const marketInput = String(r.market ?? r.exchange ?? "US").toUpperCase() as MarketCode;
  const market: MarketCode = ["US", "PL", "DE", "JP"].includes(marketInput) ? marketInput : "US";
  const marketRegimeInput = String(r.marketRegime ?? "RANGING").toUpperCase() as MarketRegime;
  const marketRegime: MarketRegime = ["TRENDING", "RANGING", "RISK_ON", "RISK_OFF"].includes(marketRegimeInput)
    ? marketRegimeInput
    : "RANGING";
  const signalTypeInput = String(r.signalType ?? r.type ?? "STANDARD").toUpperCase() as SignalKind;
  const signalType: SignalKind = ["CRITICAL", "STANDARD", "RESEARCH"].includes(signalTypeInput)
    ? signalTypeInput
    : "STANDARD";

  return {
    id,
    ticker,
    market,
    riskScore: Number(r.riskScore ?? r.score ?? 0) || 0,
    setupType: String(r.setupType ?? r.setup ?? "Unknown setup"),
    marketRegime,
    changePct: Number(r.changePct ?? r.changePercent ?? 0) || 0,
    signalType,
    price: Number(r.price ?? 0) || 0,
    winRate: Number(r.winRate ?? 0) || 0,
    avgReturn: Number(r.avgReturn ?? 0) || 0,
    maxDrawdown: Number(r.maxDrawdown ?? 0) || 0,
    totalSignals: Number(r.totalSignals ?? 0) || 0,
  };
}

export function SignalsPage() {
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<NarrativeData | null>(null);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedSignal = useMemo(
    () => signals.find((s) => s.id === selectedId) ?? null,
    [signals, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadSignals(): Promise<void> {
      setLoadingList(true);
      setListError(null);
      try {
        const { data } = await api.get<{ data?: unknown[]; items?: unknown[]; signals?: unknown[]; count?: number }>(
          "/signals",
          { params: { limit: 20 } },
        );
        const rows = (data.data ?? data.items ?? data.signals ?? [])
          .map(parseSignal)
          .filter((row): row is SignalListItem => row !== null);
        if (!cancelled) {
          if (rows.length === 0) {
            setSignals(mockSignals);
            setSelectedId(mockSignals[0].id);
          } else {
            setSignals(rows);
            setSelectedId(rows[0].id);
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (isEndpointMissing(e)) {
          setSignals(mockSignals);
          setSelectedId(mockSignals[0].id);
        } else {
          setListError(apiErrorMessage(e));
          setSignals([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    void loadSignals();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSignal) {
      setNarrative(null);
      setDna(null);
      return;
    }
    const signal = selectedSignal;
    let cancelled = false;
    async function loadDetail(): Promise<void> {
      setLoadingDetail(true);
      setDetailError(null);
      try {
        const [narrativeRes, dnaRes] = await Promise.all([
          api.get<Record<string, unknown>>(`/signals/${signal.id}/narrative`),
          api.get<Record<string, unknown>>(`/signals/${signal.id}/dna`),
        ]);
        if (cancelled) return;
        const narrativeRaw = narrativeRes.data;
        const confidenceRaw = String(narrativeRaw.confidence ?? "MEDIUM").toUpperCase() as NarrativeConfidence;
        const confidence: NarrativeConfidence = ["HIGH", "MEDIUM", "LOW"].includes(confidenceRaw)
          ? confidenceRaw
          : "MEDIUM";
        setNarrative({
          headline: String(narrativeRaw.headline ?? `${signal.ticker} signal narrative`),
          body: String(narrativeRaw.body ?? "No narrative body provided by API."),
          riskNote: String(narrativeRaw.riskNote ?? narrativeRaw.risk ?? "No risk note provided."),
          confidence,
        });
        const dnaRaw = dnaRes.data;
        const matchesInput = Array.isArray(dnaRaw.matches) ? dnaRaw.matches : [];
        const matches = matchesInput
          .map((m, idx) => {
            if (!m || typeof m !== "object") return null;
            const mm = m as Record<string, unknown>;
            return {
              id: String(mm.id ?? `${signal.id}-match-${idx + 1}`),
              similarityPct: Number(mm.similarityPct ?? mm.similarity ?? 0) || 0,
              date: String(mm.date ?? mm.createdAt ?? new Date().toISOString().slice(0, 10)),
              outcome: String(mm.outcome ?? mm.result ?? "n/a"),
            } as DnaMatch;
          })
          .filter((row): row is DnaMatch => row !== null)
          .slice(0, 3);
        setDna({ matches: matches.length > 0 ? matches : mockDna(signal).matches });
      } catch (e) {
        if (cancelled) return;
        if (isEndpointMissing(e)) {
          setNarrative(mockNarrative(signal));
          setDna(mockDna(signal));
        } else {
          setDetailError(apiErrorMessage(e));
          setNarrative(mockNarrative(signal));
          setDna(mockDna(signal));
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSignal]);

  return (
    <div className="min-h-screen bg-[#060d18] text-slate-100">
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-6">
        <aside className="w-[320px] shrink-0 space-y-3">
          <h1 className="text-xl font-semibold text-white">Signals</h1>
          {loadingList &&
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={`list-skeleton-${idx}`} className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="h-5 w-2/3 rounded bg-slate-700/60" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-700/50" />
                <div className="mt-2 h-10 w-full rounded bg-slate-700/40" />
              </div>
            ))}
          {!loadingList && listError && (
            <div className="rounded-xl border border-[#ff4a4a]/30 bg-[#ff4a4a]/10 p-3 text-sm text-[#ff7a7a]">{listError}</div>
          )}
          {!loadingList &&
            signals.map((signal) => (
              <button
                key={signal.id}
                type="button"
                onClick={() => setSelectedId(signal.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === signal.id
                    ? "border-[#00c87a]/60 bg-[#00c87a]/8"
                    : "border-slate-800 bg-slate-900/70 hover:border-[#0096ff]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {signal.ticker} <span className="text-slate-400">{signal.market}</span> {marketFlags[signal.market]}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{signal.setupType}</div>
                  </div>
                  <div className={`font-mono text-2xl font-bold ${riskScoreColor(signal.riskScore)}`}>{Math.round(signal.riskScore)}</div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded px-2 py-1 ${regimeBadgeClass(signal.marketRegime)}`}>{signal.marketRegime}</span>
                  <span className={`${signal.changePct >= 0 ? "text-[#00c87a]" : "text-[#ff4a4a]"} font-mono`}>
                    {signal.changePct >= 0 ? "+" : ""}
                    {signal.changePct.toFixed(2)}%
                  </span>
                  <span className={`ml-auto rounded px-2 py-1 font-semibold ${typeBadgeClass(signal.signalType)}`}>
                    {signal.signalType}
                  </span>
                </div>
              </button>
            ))}
        </aside>

        <section className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/55 p-5">
          {!selectedSignal && !loadingList && <div className="text-slate-400">No signal selected.</div>}
          {selectedSignal && (
            <>
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white">
                    {selectedSignal.ticker} <span className="text-sm text-slate-400">{selectedSignal.market}</span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedSignal.setupType}</p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-2xl font-semibold text-white">${selectedSignal.price.toFixed(2)}</div>
                  <div className={selectedSignal.changePct >= 0 ? "text-[#00c87a]" : "text-[#ff4a4a]"}>
                    {selectedSignal.changePct >= 0 ? "+" : ""}
                    {selectedSignal.changePct.toFixed(2)}%
                  </div>
                </div>
              </header>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <StatBox label="Risk Score" value={Math.round(selectedSignal.riskScore).toString()} valueClass={riskScoreColor(selectedSignal.riskScore)} />
                <StatBox label="Win Rate" value={`${selectedSignal.winRate.toFixed(1)}%`} valueClass="text-[#00c87a]" />
                <StatBox label="Avg Return" value={`${selectedSignal.avgReturn >= 0 ? "+" : ""}${selectedSignal.avgReturn.toFixed(2)}%`} valueClass={selectedSignal.avgReturn >= 0 ? "text-[#0096ff]" : "text-[#ff4a4a]"} />
              </div>

              {loadingDetail && (
                <div className="space-y-4">
                  <div className="animate-pulse rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                    <div className="h-6 w-1/2 rounded bg-slate-700/50" />
                    <div className="mt-3 h-4 w-full rounded bg-slate-700/40" />
                    <div className="mt-2 h-4 w-11/12 rounded bg-slate-700/40" />
                  </div>
                  <div className="animate-pulse rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                    <div className="h-5 w-1/3 rounded bg-slate-700/50" />
                    <div className="mt-3 h-20 rounded bg-slate-700/30" />
                  </div>
                </div>
              )}

              {!loadingDetail && narrative && dna && (
                <div className="space-y-5">
                  <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">Narrative</h3>
                      <span className="rounded bg-[#0096ff]/15 px-2 py-1 text-xs font-semibold text-[#0096ff]">
                        {narrative.confidence}
                      </span>
                    </div>
                    <h4 className="text-2xl font-semibold text-white">{narrative.headline}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{narrative.body}</p>
                    <p className="mt-3 border-l-2 border-[#ff4a4a] pl-3 text-sm text-slate-300">{narrative.riskNote}</p>
                  </article>

                  <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">Signal DNA</h3>
                    <div className="space-y-2">
                      {dna.matches.slice(0, 3).map((match) => (
                        <div key={match.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-[#060d18]/70 px-3 py-2">
                          <div className="text-sm text-slate-200">{match.date}</div>
                          <div className="font-mono text-sm text-[#0096ff]">{match.similarityPct.toFixed(0)}%</div>
                          <div className={`font-mono text-sm ${match.outcome.startsWith("-") ? "text-[#ff4a4a]" : "text-[#00c87a]"}`}>
                            {match.outcome}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">Discord Embed Preview</h3>
                    <div className="rounded border border-[#0096ff]/30 bg-[#0a1424] p-4">
                      <div className="text-sm text-[#0096ff]">{selectedSignal.ticker} • {selectedSignal.setupType}</div>
                      <div className="mt-2 text-xl font-semibold text-white">{narrative.headline}</div>
                      <p className="mt-2 text-sm text-slate-300">{narrative.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">Risk {Math.round(selectedSignal.riskScore)}/100</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{selectedSignal.marketRegime}</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{selectedSignal.signalType}</span>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">Track Record</h3>
                    <TrackMetric label="Win rate" valueText={`${selectedSignal.winRate.toFixed(1)}%`} barPercent={clampPercent(selectedSignal.winRate)} colorClass="bg-[#00c87a]" />
                    <TrackMetric label="Avg return" valueText={`${selectedSignal.avgReturn >= 0 ? "+" : ""}${selectedSignal.avgReturn.toFixed(2)}%`} barPercent={clampPercent((selectedSignal.avgReturn + 10) * 5)} colorClass="bg-[#0096ff]" />
                    <TrackMetric label="Max DD" valueText={`${selectedSignal.maxDrawdown.toFixed(2)}%`} barPercent={clampPercent(100 - Math.abs(selectedSignal.maxDrawdown) * 8)} colorClass="bg-[#ff4a4a]" />
                    <TrackMetric label="Total signals" valueText={selectedSignal.totalSignals.toString()} barPercent={clampPercent((selectedSignal.totalSignals / 100) * 100)} colorClass="bg-slate-400" />
                  </article>
                </div>
              )}
              {!loadingDetail && detailError && (
                <div className="mt-4 rounded-md border border-[#ff4a4a]/30 bg-[#ff4a4a]/10 p-3 text-sm text-[#ff7a7a]">
                  {detailError}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatBox(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{props.label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${props.valueClass ?? "text-white"}`}>{props.value}</div>
    </div>
  );
}

function TrackMetric(props: { label: string; valueText: string; barPercent: number; colorClass: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{props.label}</span>
        <span className="font-mono text-slate-100">{props.valueText}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-800">
        <div className={`h-full ${props.colorClass}`} style={{ width: `${props.barPercent}%` }} />
      </div>
    </div>
  );
}
