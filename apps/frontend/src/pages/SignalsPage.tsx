import { type ReactNode, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatQuoteAge } from "../utils/formatQuoteAge";
import { GlossaryTooltip } from "../components/GlossaryTooltip";

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

type LiveTransport = "SSE" | "POLLING" | "OFFLINE";

type CopilotPlan = {
  action: "ENTER" | "WAIT" | "REDUCE";
  conviction: number;
  thesis: string;
  invalidation: string;
  nextCheckpoint: string;
};

type ExecutionPlan = {
  entry: number;
  stop: number;
  target: number;
  rr: number;
  expectedValuePct: number;
  worstCasePct: number;
};

type ConfidenceCue = "PRIME" | "STRONG" | "WATCH";
type MentorStyle = "supportive" | "strict";
type MentorGuidance = {
  title: string;
  guidance: string;
  riskCheck: string;
};

const marketFlags: Record<MarketCode, string> = {
  US: "🇺🇸",
  PL: "🇵🇱",
  DE: "🇩🇪",
  JP: "🇯🇵",
};

const GLOSSARY_TERMS = ["RSI", "MACD", "VWAP", "breakout", "oversold"] as const;

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
  if (score >= 80) return "text-brand-green";
  if (score >= 60) return "text-brand-blue";
  return "text-brand-red";
}

function typeBadgeClass(type: SignalKind): string {
  if (type === "CRITICAL") return "bg-brand-green/15 text-brand-green border border-brand-green/30";
  if (type === "STANDARD") return "bg-brand-blue/15 text-brand-blue border border-brand-blue/30";
  return "bg-brand-red/15 text-brand-red border border-brand-red/30";
}

function regimeBadgeClass(regime: MarketRegime): string {
  if (regime === "TRENDING") return "bg-brand-green/15 text-brand-green";
  if (regime === "RANGING") return "bg-slate-500/25 text-slate-200";
  if (regime === "RISK_ON") return "bg-brand-blue/15 text-brand-blue";
  return "bg-brand-red/15 text-brand-red";
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

function unpackSignalRows(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.data)) return d.data;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.signals)) return d.signals;
  if (Array.isArray(d.signalUpdates)) return d.signalUpdates;
  return [];
}

function rankSignals(rows: SignalListItem[]): SignalListItem[] {
  return [...rows].sort((a, b) => {
    const lhs = a.riskScore * 0.55 + a.winRate * 0.35 + a.changePct * 2;
    const rhs = b.riskScore * 0.55 + b.winRate * 0.35 + b.changePct * 2;
    return rhs - lhs;
  });
}

function mergeSignals(prev: SignalListItem[], incoming: SignalListItem[]): SignalListItem[] {
  const map = new Map(prev.map((s) => [s.id, s] as const));
  for (const row of incoming) {
    const existing = map.get(row.id);
    map.set(row.id, existing ? { ...existing, ...row } : row);
  }
  return rankSignals([...map.values()]);
}

function regimeProtocol(regime: MarketRegime): { mode: string; style: string; riskCap: string; color: string } {
  if (regime === "TRENDING") {
    return { mode: "Trend Acceleration", style: "Breakout continuation", riskCap: "1.25R", color: "text-brand-green" };
  }
  if (regime === "RISK_ON") {
    return { mode: "Pro-Risk Expansion", style: "Momentum basket", riskCap: "1.00R", color: "text-brand-blue" };
  }
  if (regime === "RISK_OFF") {
    return { mode: "Capital Defense", style: "Mean-reversion only", riskCap: "0.50R", color: "text-brand-red" };
  }
  return { mode: "Neutral Grid", style: "Range edges + quick exits", riskCap: "0.75R", color: "text-slate-300" };
}

function buildCopilotPlan(signal: SignalListItem, narrative: NarrativeData | null): CopilotPlan {
  const conviction = clampPercent(Math.round(signal.riskScore * 0.65 + signal.winRate * 0.35));
  const action: CopilotPlan["action"] =
    signal.riskScore >= 80 && signal.changePct >= 0 ? "ENTER" : signal.riskScore < 60 ? "REDUCE" : "WAIT";
  return {
    action,
    conviction,
    thesis: narrative?.headline ?? `${signal.setupType} aligned with ${signal.marketRegime}`,
    invalidation: `Exit if move reaches ${signal.maxDrawdown.toFixed(1)}% from entry or regime flips.`,
    nextCheckpoint: "Re-evaluate after next session close and fresh volume print.",
  };
}

function buildExecutionPlan(signal: SignalListItem): ExecutionPlan {
  const entry = signal.price;
  const stopDistancePct = Math.max(1.2, Math.abs(signal.maxDrawdown) * 0.45);
  const targetDistancePct = Math.max(1.8, Math.abs(signal.avgReturn) * 1.4);
  const stop = entry * (1 - stopDistancePct / 100);
  const target = entry * (1 + targetDistancePct / 100);
  const rr = (target - entry) / Math.max(0.0001, entry - stop);
  const winP = clampPercent(signal.winRate) / 100;
  const expectedValuePct = winP * targetDistancePct - (1 - winP) * stopDistancePct;
  return {
    entry,
    stop,
    target,
    rr,
    expectedValuePct,
    worstCasePct: -stopDistancePct,
  };
}

function buildWatchlist(signals: SignalListItem[]): SignalListItem[] {
  return [...signals]
    .sort((a, b) => b.riskScore * 0.55 + b.winRate * 0.45 - (a.riskScore * 0.55 + a.winRate * 0.45))
    .slice(0, 5);
}

function confidenceCue(signal: SignalListItem): ConfidenceCue {
  const prime = signal.riskScore >= 80 && signal.winRate >= 65 && (signal.marketRegime === "TRENDING" || signal.marketRegime === "RISK_ON");
  if (prime) return "PRIME";
  if (signal.riskScore >= 70 && signal.winRate >= 57) return "STRONG";
  return "WATCH";
}

function confidenceCueClass(level: ConfidenceCue): string {
  if (level === "PRIME") return "bg-brand-violet/20 text-brand-violet border border-brand-violet/45";
  if (level === "STRONG") return "bg-brand-blue/18 text-brand-blue border border-brand-blue/35";
  return "bg-brand-amber/18 text-brand-amber border border-brand-amber/35";
}

function dnaRationale(match: DnaMatch): { why: string; counter: string } {
  if (match.similarityPct >= 90) {
    return {
      why: "Price structure and volatility regime are near-identical.",
      counter: "Macro context differs; avoid oversized position.",
    };
  }
  if (match.similarityPct >= 85) {
    return {
      why: "Momentum profile and volume compression match historical winners.",
      counter: "Signal can decay quickly without follow-through volume.",
    };
  }
  return {
    why: "Partial setup overlap with lower confidence.",
    counter: "Treat as supporting evidence, not primary trigger.",
  };
}

function renderGlossaryTerms(input: string): ReactNode {
  const escapedTerms = GLOSSARY_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escapedTerms.join("|")})\\b`, "gi");
  const parts = input.split(regex);
  return parts.map((part, index) => {
    const matched = GLOSSARY_TERMS.find((term) => term.toLowerCase() === part.toLowerCase());
    if (!matched) {
      return <span key={`txt-${index}`}>{part}</span>;
    }
    return (
      <GlossaryTooltip key={`term-${matched}-${index}`} term={matched}>
        {part}
      </GlossaryTooltip>
    );
  });
}

function readMentorModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("mentorModeEnabled") === "true";
}

function readMentorStyle(): MentorStyle {
  if (typeof window === "undefined") return "supportive";
  const stored = window.localStorage.getItem("mentorStyle");
  return stored === "strict" ? "strict" : "supportive";
}

export function SignalsPage() {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<NarrativeData | null>(null);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [liveTransport, setLiveTransport] = useState<LiveTransport>("OFFLINE");
  const [liveNote, setLiveNote] = useState<string>("Waiting for stream...");
  const [lastLiveAt, setLastLiveAt] = useState<string | null>(null);
  const [hotSignalIds, setHotSignalIds] = useState<string[]>([]);
  const [mentorModeEnabled, setMentorModeEnabled] = useState<boolean>(() => readMentorModeEnabled());
  const [mentorStyle, setMentorStyle] = useState<MentorStyle>(() => readMentorStyle());
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorError, setMentorError] = useState<string | null>(null);
  const [mentorGuidance, setMentorGuidance] = useState<MentorGuidance | null>(null);

  const selectedSignal = useMemo(
    () => signals.find((s) => s.id === selectedId) ?? null,
    [signals, selectedId],
  );
  const copilot = useMemo(
    () => (selectedSignal ? buildCopilotPlan(selectedSignal, narrative) : null),
    [selectedSignal, narrative],
  );
  const execution = useMemo(
    () => (selectedSignal ? buildExecutionPlan(selectedSignal) : null),
    [selectedSignal],
  );
  const watchlist = useMemo(() => buildWatchlist(signals), [signals]);
  const regime = useMemo(
    () => (selectedSignal ? regimeProtocol(selectedSignal.marketRegime) : null),
    [selectedSignal],
  );

  const [liveQuoteBadge, setLiveQuoteBadge] = useState<{ updatedAt: string; source?: string } | null>(null);
  const [quoteNowMs, setQuoteNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setQuoteNowMs(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedSignal) {
      setLiveQuoteBadge(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const { data } = await api.get<{ quote?: { updatedAt?: string; source?: string } }>("/quotes/latest", {
          params: { ticker: selectedSignal.ticker },
        });
        if (cancelled) return;
        if (data.quote?.updatedAt) {
          setLiveQuoteBadge({ updatedAt: data.quote.updatedAt, source: data.quote.source });
        } else {
          setLiveQuoteBadge(null);
        }
      } catch {
        if (!cancelled) setLiveQuoteBadge(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSignal]);

  useEffect(() => {
    const syncSettings = () => {
      setMentorModeEnabled(readMentorModeEnabled());
      setMentorStyle(readMentorStyle());
    };
    window.addEventListener("storage", syncSettings);
    return () => window.removeEventListener("storage", syncSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSignals(): Promise<void> {
      setLoadingList(true);
      setListError(null);
      try {
        const { data } = await api.get<Record<string, unknown>>("/signals", { params: { limit: 20 } });
        const rows = unpackSignalRows(data)
          .map(parseSignal)
          .filter((row): row is SignalListItem => row !== null);
        if (!cancelled) {
          if (rows.length === 0) {
            setSignals(rankSignals(mockSignals));
            setSelectedId(mockSignals[0]?.id ?? null);
          } else {
            const ranked = rankSignals(rows);
            setSignals(ranked);
            setSelectedId(ranked[0]?.id ?? null);
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
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let clearHotTimer: ReturnType<typeof setTimeout> | null = null;

    const markLiveUpdate = (ids: string[], note: string) => {
      if (cancelled || ids.length === 0) return;
      setLastLiveAt(new Date().toISOString());
      setLiveNote(note);
      setHotSignalIds(ids.slice(0, 8));
      if (clearHotTimer) clearTimeout(clearHotTimer);
      clearHotTimer = setTimeout(() => setHotSignalIds([]), 2000);
    };

    const applyRows = (rows: SignalListItem[], source: "SSE" | "POLLING") => {
      if (rows.length === 0) return;
      setSignals((prev) => mergeSignals(prev, rows));
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
      markLiveUpdate(
        rows.map((r) => r.id),
        source === "SSE" ? "Live stream update received" : "Polling update received",
      );
    };

    const startPolling = () => {
      if (cancelled || pollTimer) return;
      setLiveTransport("POLLING");
      setLiveNote("SSE unavailable — polling every 15s");
      const pull = async () => {
        try {
          const { data } = await api.get<Record<string, unknown>>("/signals", { params: { limit: 20 } });
          const rows = unpackSignalRows(data)
            .map(parseSignal)
            .filter((row): row is SignalListItem => row !== null);
          applyRows(rows, "POLLING");
        } catch {
          // keep silent; page already handles missing APIs with mocks
        }
      };
      void pull();
      pollTimer = setInterval(() => {
        void pull();
      }, 15_000);
    };

    const trySse = () => {
      const base = String(api.defaults.baseURL ?? "http://localhost:3000/api").replace(/\/$/, "");
      const streamUrl = `${base}/signals/stream`;
      try {
        eventSource = new EventSource(streamUrl);
      } catch {
        startPolling();
        return;
      }
      eventSource.onopen = () => {
        if (cancelled) return;
        setLiveTransport("SSE");
        setLiveNote("Connected to live stream");
      };
      eventSource.onmessage = (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data) as unknown;
          const rows = (Array.isArray(payload) ? payload : unpackSignalRows(payload))
            .map(parseSignal)
            .filter((row): row is SignalListItem => row !== null);
          applyRows(rows, "SSE");
        } catch {
          // ignore malformed packet
        }
      };
      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!cancelled) startPolling();
      };
    };

    trySse();
    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
      if (pollTimer) clearInterval(pollTimer);
      if (clearHotTimer) clearTimeout(clearHotTimer);
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

  useEffect(() => {
    if (!mentorModeEnabled || !selectedSignal) {
      setMentorGuidance(null);
      setMentorError(null);
      setMentorLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMentorGuidance(): Promise<void> {
      setMentorLoading(true);
      setMentorError(null);
      if (!selectedSignal) return;
      try {
        const { data } = await api.post<MentorGuidance>("/mentor/guidance", {
          ticker: selectedSignal.ticker,
          setupType: selectedSignal.setupType,
          riskScore: selectedSignal.riskScore,
          marketRegime: selectedSignal.marketRegime,
          mentorStyle,
          lang: "en",
        });
        if (!cancelled) {
          setMentorGuidance(data);
        }
      } catch (error) {
        if (cancelled) return;
        setMentorGuidance(null);
        setMentorError(apiErrorMessage(error));
      } finally {
        if (!cancelled) setMentorLoading(false);
      }
    }

    void loadMentorGuidance();
    return () => {
      cancelled = true;
    };
  }, [mentorModeEnabled, mentorStyle, selectedSignal]);

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-6">
        <aside className="w-[320px] shrink-0 space-y-3">
          <h1 className="text-xl font-semibold text-white">{t("signals.title")}</h1>
          <button
            type="button"
            onClick={() => {
              const next = !mentorModeEnabled;
              setMentorModeEnabled(next);
              window.localStorage.setItem("mentorModeEnabled", String(next));
            }}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              mentorModeEnabled
                ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
            }`}
          >
            {t("mentor.toggleLabel")}: {mentorModeEnabled ? t("mentor.enabled") : t("mentor.disabled")}
          </button>
          <p className="text-[11px] leading-5 text-slate-400">
            <GlossaryTooltip term="RSI">RSI</GlossaryTooltip> ·{" "}
            <GlossaryTooltip term="MACD">MACD</GlossaryTooltip> ·{" "}
            <GlossaryTooltip term="VWAP">VWAP</GlossaryTooltip> ·{" "}
            <GlossaryTooltip term="breakout">breakout</GlossaryTooltip> ·{" "}
            <GlossaryTooltip term="oversold">oversold</GlossaryTooltip>
          </p>
          <div className="neo-panel rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Live Engine</span>
              <div className="flex items-center gap-2">
                {liveTransport !== "OFFLINE" && <span className="live-dot" />}
                <span
                  className={`rounded px-2 py-0.5 font-semibold ${
                    liveTransport === "SSE"
                      ? "bg-brand-green/15 text-brand-green"
                      : liveTransport === "POLLING"
                        ? "bg-brand-blue/15 text-brand-blue"
                        : "bg-slate-700/40 text-slate-300"
                  }`}
                >
                  {liveTransport}
                </span>
              </div>
            </div>
            <p className="mt-2 text-slate-300">{liveNote}</p>
            <p className="mt-1 font-mono text-slate-500">
              {lastLiveAt ? `last: ${new Date(lastLiveAt).toLocaleTimeString()}` : "last: --:--:--"}
            </p>
          </div>
          {loadingList &&
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={`list-skeleton-${idx}`} className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="h-5 w-2/3 rounded bg-slate-700/60" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-700/50" />
                <div className="mt-2 h-10 w-full rounded bg-slate-700/40" />
              </div>
            ))}
          {!loadingList && listError && (
            <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">{listError}</div>
          )}
          {!loadingList &&
            signals.map((signal) => {
              const cue = confidenceCue(signal);
              return (
                <button
                  key={signal.id}
                  type="button"
                  onClick={() => setSelectedId(signal.id)}
                  className={`interactive-tilt w-full rounded-xl border p-3 text-left transition ${
                    selectedId === signal.id
                      ? "border-brand-green/60 bg-brand-green/10"
                      : hotSignalIds.includes(signal.id)
                        ? "border-brand-blue/60 bg-brand-blue/10"
                        : "border-slate-800 bg-slate-900/70 hover:border-brand-blue/50"
                  } ${cue === "PRIME" ? "confidence-halo" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {signal.ticker} <span className="text-slate-400">{signal.market}</span> {marketFlags[signal.market]}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{renderGlossaryTerms(signal.setupType)}</div>
                      <span className={`mt-2 inline-flex rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide ${confidenceCueClass(cue)}`}>
                        {cue}
                      </span>
                    </div>
                    <div className={`font-mono text-2xl font-bold ${riskScoreColor(signal.riskScore)}`}>{Math.round(signal.riskScore)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded px-2 py-1 ${regimeBadgeClass(signal.marketRegime)}`}>{signal.marketRegime}</span>
                    <span className={`${signal.changePct >= 0 ? "text-brand-green" : "text-brand-red"} font-mono`}>
                      {signal.changePct >= 0 ? "+" : ""}
                      {signal.changePct.toFixed(2)}%
                    </span>
                    <span className={`ml-auto rounded px-2 py-1 font-semibold ${typeBadgeClass(signal.signalType)}`}>
                      {signal.signalType}
                    </span>
                  </div>
                </button>
              );
            })}
          {!loadingList && watchlist.length > 0 && (
            <div className="neo-panel rounded-xl p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-blue">Autonomous Watchlist</h3>
              <div className="space-y-2">
                {watchlist.map((w) => (
                  <div key={`watch-${w.id}`} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">
                      {w.ticker} {marketFlags[w.market]}
                    </span>
                    <span className={`font-mono ${riskScoreColor(w.riskScore)}`}>{Math.round(w.riskScore)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="neo-panel neo-panel-accent min-w-0 flex-1 rounded-xl p-5">
          {!selectedSignal && !loadingList && <div className="text-slate-400">No signal selected.</div>}
          {selectedSignal && (
            <>
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white">
                    {selectedSignal.ticker} <span className="text-sm text-slate-400">{selectedSignal.market}</span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{renderGlossaryTerms(selectedSignal.setupType)}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                    <GlossaryTooltip term="RSI">RSI</GlossaryTooltip>
                    <span>•</span>
                    <GlossaryTooltip term="MACD">MACD</GlossaryTooltip>
                    <span>•</span>
                    <GlossaryTooltip term="VWAP">VWAP</GlossaryTooltip>
                    <span>•</span>
                    <GlossaryTooltip term="breakout">breakout</GlossaryTooltip>
                    <span>•</span>
                    <GlossaryTooltip term="oversold">oversold</GlossaryTooltip>
                  </div>
                  <span
                    className={`mt-2 inline-flex rounded px-2 py-1 text-xs font-semibold tracking-wide ${confidenceCueClass(confidenceCue(selectedSignal))}`}
                  >
                    Confidence: {confidenceCue(selectedSignal)}
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div className="text-2xl font-semibold text-white">${selectedSignal.price.toFixed(2)}</div>
                  <div className={selectedSignal.changePct >= 0 ? "text-brand-green" : "text-brand-red"}>
                    {selectedSignal.changePct >= 0 ? "+" : ""}
                    {selectedSignal.changePct.toFixed(2)}%
                  </div>
                  <Link
                    to={`/premortem?${new URLSearchParams({
                      symbol: selectedSignal.ticker,
                      entry: selectedSignal.price.toFixed(2),
                      stopLoss: (selectedSignal.price * 0.98).toFixed(2),
                      takeProfit: (selectedSignal.price * 1.03).toFixed(2),
                      quantity: "1",
                      regime: selectedSignal.marketRegime,
                    }).toString()}`}
                    className="mt-2 inline-block text-xs font-semibold text-brand-blue hover:underline"
                  >
                    {t("signals.preMortemFromSetup")}
                  </Link>
                  {liveQuoteBadge ? (
                    <div className="mt-1 text-xs text-slate-400">
                      {t("pearls.quoteChip", {
                        age: formatQuoteAge(liveQuoteBadge.updatedAt, quoteNowMs),
                        source: liveQuoteBadge.source ?? "—",
                      })}
                    </div>
                  ) : null}
                </div>
              </header>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <StatBox label={t("signals.riskScore")} value={Math.round(selectedSignal.riskScore).toString()} valueClass={riskScoreColor(selectedSignal.riskScore)} />
                <StatBox label={t("signals.winRate")} value={`${selectedSignal.winRate.toFixed(1)}%`} valueClass="text-brand-green" />
                <StatBox label={t("signals.avgReturn")} value={`${selectedSignal.avgReturn >= 0 ? "+" : ""}${selectedSignal.avgReturn.toFixed(2)}%`} valueClass={selectedSignal.avgReturn >= 0 ? "text-brand-blue" : "text-brand-red"} />
              </div>

              {regime && (
                <article className="neo-panel mb-5 rounded-lg p-4">
                  <h3 className="mb-2 text-lg font-semibold text-white">Live Market Regime Engine</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <MiniInfo label="Mode" value={regime.mode} valueClass={regime.color} />
                    <MiniInfo label="Execution Style" value={regime.style} />
                    <MiniInfo label="Risk Cap / Trade" value={regime.riskCap} />
                  </div>
                </article>
              )}

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
                  {mentorModeEnabled && (
                    <article className="neo-panel rounded-lg border border-brand-green/35 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-brand-green">{t("mentor.panelTitle")}</h3>
                        <span className="rounded bg-brand-green/15 px-2 py-1 text-xs text-brand-green">
                          {mentorStyle === "strict" ? t("mentor.styleStrict") : t("mentor.styleSupportive")}
                        </span>
                      </div>
                      {mentorLoading ? <p className="text-sm text-slate-300">{t("mentor.loading")}</p> : null}
                      {!mentorLoading && mentorError ? (
                        <p className="text-sm text-brand-red">{mentorError}</p>
                      ) : null}
                      {!mentorLoading && !mentorError && mentorGuidance ? (
                        <div className="space-y-2 text-sm text-slate-200">
                          <p className="font-semibold text-white">{mentorGuidance.title}</p>
                          <p>{mentorGuidance.guidance}</p>
                          <p className="text-brand-green">
                            {t("mentor.riskCheckLabel")}: {mentorGuidance.riskCheck}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  )}

                  {copilot && (
                    <article className="neo-panel neo-panel-accent rounded-lg p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">AI Copilot Decision</h3>
                        <span className="rounded bg-brand-green/15 px-2 py-1 text-xs font-semibold text-brand-green">
                          {copilot.action}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{copilot.thesis}</p>
                      <div className="mt-3">
                        <TrackMetric
                          label="Conviction"
                          valueText={`${copilot.conviction}%`}
                          barPercent={copilot.conviction}
                          colorClass="bg-brand-green"
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">Invalidation: {copilot.invalidation}</p>
                      <p className="mt-1 text-xs text-slate-400">Checkpoint: {copilot.nextCheckpoint}</p>
                    </article>
                  )}

                  <article className="neo-panel rounded-lg p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">{t("signals.narrative")}</h3>
                      <span className="rounded bg-brand-blue/15 px-2 py-1 text-xs font-semibold text-brand-blue">
                        {narrative.confidence}
                      </span>
                    </div>
                    <h4 className="text-2xl font-semibold text-white">{narrative.headline}</h4>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{narrative.body}</p>
                    <p className="mt-3 border-l-2 border-brand-red pl-3 text-sm text-slate-300">{narrative.riskNote}</p>
                  </article>

                  <article className="neo-panel rounded-lg p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">{t("signals.dna")}</h3>
                    <div className="space-y-2">
                      {dna.matches.slice(0, 3).map((match) => {
                        const explanation = dnaRationale(match);
                        return (
                          <div key={match.id} className="rounded-md border border-slate-800 bg-[#060d18]/70 px-3 py-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-slate-200">{match.date}</div>
                              <div className="font-mono text-sm text-brand-blue">{match.similarityPct.toFixed(0)}%</div>
                              <div
                                className={`font-mono text-sm ${match.outcome.startsWith("-") ? "text-brand-red" : "text-brand-green"}`}
                              >
                                {match.outcome}
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-300">Why similar: {explanation.why}</p>
                            <p className="mt-1 text-xs text-brand-red">Counterpoint: {explanation.counter}</p>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="neo-panel rounded-lg p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">Discord Embed Preview</h3>
                    <div className="rounded border border-brand-blue/30 bg-brand-bg/70 p-4 spot-glow">
                      <div className="text-sm text-brand-blue">
                        {selectedSignal.ticker} • {renderGlossaryTerms(selectedSignal.setupType)}
                      </div>
                      <div className="mt-2 text-xl font-semibold text-white">{narrative.headline}</div>
                      <p className="mt-2 text-sm text-slate-300">{narrative.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">Risk {Math.round(selectedSignal.riskScore)}/100</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{selectedSignal.marketRegime}</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-slate-200">{selectedSignal.signalType}</span>
                      </div>
                    </div>
                  </article>

                  <article className="neo-panel rounded-lg p-4">
                    <h3 className="mb-3 text-lg font-semibold text-white">Track Record</h3>
                    <TrackMetric label="Win rate" valueText={`${selectedSignal.winRate.toFixed(1)}%`} barPercent={clampPercent(selectedSignal.winRate)} colorClass="bg-brand-green" />
                    <TrackMetric label="Avg return" valueText={`${selectedSignal.avgReturn >= 0 ? "+" : ""}${selectedSignal.avgReturn.toFixed(2)}%`} barPercent={clampPercent((selectedSignal.avgReturn + 10) * 5)} colorClass="bg-brand-blue" />
                    <TrackMetric label="Max DD" valueText={`${selectedSignal.maxDrawdown.toFixed(2)}%`} barPercent={clampPercent(100 - Math.abs(selectedSignal.maxDrawdown) * 8)} colorClass="bg-brand-red" />
                    <TrackMetric label="Total signals" valueText={selectedSignal.totalSignals.toString()} barPercent={clampPercent((selectedSignal.totalSignals / 100) * 100)} colorClass="bg-slate-400" />
                  </article>

                  {execution && (
                    <article className="neo-panel rounded-lg p-4">
                      <h3 className="mb-3 text-lg font-semibold text-white">Battle-Tested Execution Simulator</h3>
                      <div className="grid gap-3 md:grid-cols-3">
                        <MiniInfo label="Entry" value={`$${execution.entry.toFixed(2)}`} valueClass="font-mono text-white" />
                        <MiniInfo label="Stop" value={`$${execution.stop.toFixed(2)}`} valueClass="font-mono text-brand-red" />
                        <MiniInfo label="Target" value={`$${execution.target.toFixed(2)}`} valueClass="font-mono text-brand-green" />
                        <MiniInfo label="R:R" value={`${execution.rr.toFixed(2)}R`} valueClass="font-mono text-brand-blue" />
                        <MiniInfo
                          label="Expected Value"
                          value={`${execution.expectedValuePct >= 0 ? "+" : ""}${execution.expectedValuePct.toFixed(2)}%`}
                          valueClass={`font-mono ${execution.expectedValuePct >= 0 ? "text-brand-green" : "text-brand-red"}`}
                        />
                        <MiniInfo label="Worst Case" value={`${execution.worstCasePct.toFixed(2)}%`} valueClass="font-mono text-brand-red" />
                      </div>
                    </article>
                  )}
                </div>
              )}
              {!loadingDetail && detailError && (
                <div className="mt-4 rounded-md border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
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
    <div className="neo-panel rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{props.label}</div>
      <div className={`mt-2 font-mono text-2xl font-bold ${props.valueClass ?? "text-white"}`}>{props.value}</div>
    </div>
  );
}

function MiniInfo(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded border border-brand-border/80 bg-brand-bg/70 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{props.label}</div>
      <div className={`mt-1 text-sm text-slate-200 ${props.valueClass ?? ""}`}>{props.value}</div>
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
        <div className={`risk-beam h-full ${props.colorClass}`} style={{ width: `${props.barPercent}%` }} />
      </div>
    </div>
  );
}
