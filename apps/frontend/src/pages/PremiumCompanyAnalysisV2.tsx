import axios from "axios";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InvestmentDisclaimer } from "../components/InvestmentDisclaimer";
import {
  CockpitBand,
  CompactEmptyState,
  SectionEyebrow,
  TerminalBadge,
  TerminalPanel,
  TerminalWorkspacePage,
  TERMINAL_ACCENT_RAIL_AMBER,
  TERMINAL_ACCENT_RAIL_CYAN,
  TERMINAL_ACCENT_RAIL_LIME,
  cn,
} from "../components/terminal";
import {
  getPremiumAnalysis,
  type PremiumAnalysisBundle,
  type PremiumAnalysisContract,
  type PremiumFieldStatus,
  type PremiumNumericClaim,
  type PremiumScenario,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  getPremiumAnalysisV2SessionCache,
  premiumAnalysisV2CacheKey,
  setPremiumAnalysisV2SessionCache,
} from "../utils/premiumAnalysisV2Session";
import {
  ANALYTICS_EVENTS,
  trackEvent,
  trackPremiumAnalysisV2Loaded,
} from "../utils/analytics";

type V2ErrorKind = "access" | "limit" | "generic";

function resolveLanguage(raw: string): string {
  const lang = raw.trim().toLowerCase();
  return lang.startsWith("pl") ? "pl" : "en";
}

function parseV2Error(error: unknown): { kind: V2ErrorKind; message: string } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const bodyMsg =
      typeof error.response?.data === "object" &&
      error.response?.data != null &&
      "error" in error.response.data
        ? String((error.response.data as { error?: string }).error)
        : null;
    if (status === 401 || status === 403) {
      return {
        kind: "access",
        message: bodyMsg ?? "Premium analysis requires an active subscription.",
      };
    }
    if (status === 429) {
      return {
        kind: "limit",
        message: bodyMsg ?? "Premium analysis limit reached. Try again later.",
      };
    }
    if (status === 500 || status === 502 || status === 503) {
      return {
        kind: "generic",
        message: bodyMsg ?? "Analysis service temporarily unavailable.",
      };
    }
  }
  if (error instanceof Error && error.message) {
    return { kind: "generic", message: error.message };
  }
  return { kind: "generic", message: "Unable to load premium analysis bundle." };
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}-${hash.slice(-4)}` : hash;
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function verdictBadgeVariant(
  label: PremiumAnalysisContract["executiveVerdict"]["label"],
): "default" | "ai" | "warning" {
  if (label === "bullish" || label === "constructive") return "ai";
  if (label === "avoid" || label === "watch") return "warning";
  return "default";
}

function statusChipClass(status: PremiumFieldStatus): string {
  if (status === "ok") return "border-terminal-positive/40 text-terminal-positive";
  if (status === "requires_access" || status === "missing" || status === "stale") {
    return "border-amber-400/50 text-amber-200";
  }
  return "border-terminal-border text-terminal-muted";
}

function SeverityChip({ value }: { value: string }) {
  const tone =
    value === "high"
      ? "border-red-400/50 text-red-300"
      : value === "medium"
        ? "border-amber-400/50 text-amber-200"
        : "border-terminal-border text-terminal-muted";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase", tone)}>
      {value}
    </span>
  );
}

function MetricsTable({ metrics }: { metrics: PremiumNumericClaim[] }) {
  if (!metrics.length) {
    return (
      <CompactEmptyState title="No quantitative metrics" message="Snapshot did not provide validated numeric claims." />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-terminal-border text-terminal-muted">
            <th className="py-1.5 pr-2 font-medium">Value</th>
            <th className="py-1.5 pr-2 font-medium">Unit</th>
            <th className="py-1.5 pr-2 font-medium">Basis</th>
            <th className="py-1.5 pr-2 font-medium">Source</th>
            <th className="py-1.5 font-medium">As of</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((row, idx) => (
            <tr key={`${row.source}-${idx}`} className="border-b border-terminal-border/60">
              <td className="py-1.5 pr-2 font-mono text-terminal-text">{row.value}</td>
              <td className="py-1.5 pr-2 text-terminal-muted">{row.unit ?? "-"}</td>
              <td className="py-1.5 pr-2 text-terminal-text">{row.basis}</td>
              <td className="py-1.5 pr-2 font-mono text-[10px] text-terminal-cyan/90">{row.source}</td>
              <td className="py-1.5 font-mono text-[10px] text-terminal-muted">
                {row.asOf ? formatIso(row.asOf) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: PremiumScenario }) {
  const accent =
    scenario.name === "bull"
      ? TERMINAL_ACCENT_RAIL_LIME
      : scenario.name === "bear"
        ? TERMINAL_ACCENT_RAIL_AMBER
        : TERMINAL_ACCENT_RAIL_CYAN;
  return (
    <TerminalPanel className={cn(accent, "flex flex-col gap-2 p-3")}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-terminal-cyan">{scenario.name}</span>
        <span className="font-mono text-sm text-terminal-text">{scenario.probabilityPct}%</span>
      </div>
      <p className="text-sm leading-relaxed text-terminal-text">{scenario.narrative}</p>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-terminal-muted">Drivers</p>
        <ul className="mt-1 list-inside list-disc text-xs text-terminal-text">
          {scenario.drivers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-terminal-muted">Risks</p>
        <ul className="mt-1 list-inside list-disc text-xs text-terminal-text">
          {scenario.risks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-amber-200/90">
        <span className="font-medium text-terminal-muted">Invalidation: </span>
        {scenario.invalidation}
      </p>
      {scenario.priceTarget ? (
        <p className="rounded border border-terminal-border/80 bg-terminal-bg/40 px-2 py-1.5 font-mono text-[10px] text-terminal-muted">
          Reference level {scenario.priceTarget.value}
          {scenario.priceTarget.unit ? ` ${scenario.priceTarget.unit}` : ""} - {scenario.priceTarget.basis} (
          {scenario.priceTarget.source}
          {scenario.priceTarget.asOf ? `, ${formatIso(scenario.priceTarget.asOf)}` : ""}). Not a recommendation.
        </p>
      ) : null}
    </TerminalPanel>
  );
}

function SectionBlock({
  title,
  accent = TERMINAL_ACCENT_RAIL_CYAN,
  children,
}: {
  title: string;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <TerminalPanel className={cn(accent, "space-y-2 p-3 sm:p-4")}>
      <SectionEyebrow accent>{title}</SectionEyebrow>
      {children}
    </TerminalPanel>
  );
}

export type PremiumCompanyAnalysisV2Props = {
  onUseLegacy: () => void;
};

export function PremiumCompanyAnalysisV2({ onUseLegacy }: PremiumCompanyAnalysisV2Props) {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const ticker = decodeURIComponent(symbol).trim().toUpperCase();
  const language = useMemo(() => resolveLanguage(i18n.language), [i18n.language]);
  const cacheKey = useMemo(
    () => (ticker ? premiumAnalysisV2CacheKey(ticker, language) : ""),
    [ticker, language],
  );

  const [bundle, setBundle] = useState<PremiumAnalysisBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: V2ErrorKind; message: string } | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const loadedTelemetryKeysRef = useRef(new Set<string>());

  const recordV2LoadedTelemetry = (payload: PremiumAnalysisBundle, telemetryKey: string) => {
    if (loadedTelemetryKeysRef.current.has(telemetryKey)) return;
    loadedTelemetryKeysRef.current.add(telemetryKey);
    trackPremiumAnalysisV2Loaded(payload, { symbol: ticker, language }, language);
  };

  useEffect(() => {
    if (!ticker || isAuthLoading) return;
    const cached = getPremiumAnalysisV2SessionCache(cacheKey);
    if (cached?.contract) {
      setBundle(cached);
      setError(null);
      recordV2LoadedTelemetry(cached, cacheKey);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getPremiumAnalysis(ticker, { language })
      .then((payload) => {
        if (cancelled) return;
        if (!payload?.contract?.executiveVerdict) {
          setError({ kind: "generic", message: "Malformed analysis response from server." });
          setBundle(null);
          return;
        }
        setPremiumAnalysisV2SessionCache(cacheKey, payload);
        setBundle(payload);
        recordV2LoadedTelemetry(payload, cacheKey);
      })
      .catch((err) => {
        if (cancelled) return;
        setBundle(null);
        setError(parseV2Error(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, isAuthLoading, language, ticker]);

  useEffect(() => {
    if (!ticker) return;
    trackEvent(ANALYTICS_EVENTS.PREMIUM_ANALYSIS_V2_VIEW, { symbol: ticker, language }, language);
  }, [language, ticker]);

  const contract = bundle?.contract;

  if (!ticker) {
    return (
      <TerminalWorkspacePage title="Premium Analysis">
        <CompactEmptyState title="Missing symbol" message="Open premium analysis from a company page." />
      </TerminalWorkspacePage>
    );
  }

  if (loading && !bundle) {
    return (
      <TerminalWorkspacePage title="Premium Analysis" subtitle={ticker}>
        <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_CYAN, "p-6 text-sm text-terminal-muted")}>
          Loading institutional analysis bundle-
        </TerminalPanel>
      </TerminalWorkspacePage>
    );
  }

  if (error) {
    return (
      <TerminalWorkspacePage title="Premium Analysis" subtitle={ticker}>
        <TerminalPanel className={cn(TERMINAL_ACCENT_RAIL_AMBER, "space-y-3 p-4")}>
          <p className="text-sm text-terminal-text">{error.message}</p>
          {error.kind === "access" ? (
            <div className="flex flex-wrap gap-2">
              {!user ? (
                <button
                  type="button"
                  className="rounded border border-terminal-cyan/50 px-3 py-1.5 text-xs text-terminal-cyan"
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              ) : null}
              <Link
                to="/pricing"
                className="rounded border border-terminal-border px-3 py-1.5 text-xs text-terminal-text hover:border-terminal-cyan/50"
              >
                View plans
              </Link>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onUseLegacy}
            className="text-xs text-terminal-cyan underline-offset-2 hover:underline"
          >
            Use legacy premium analysis (5-screen flow)
          </button>
        </TerminalPanel>
        <InvestmentDisclaimer className="mt-6" />
      </TerminalWorkspacePage>
    );
  }

  if (!contract || !bundle) {
    return (
      <TerminalWorkspacePage title="Premium Analysis" subtitle={ticker}>
        <CompactEmptyState
          title="Analysis unavailable"
          message="No contract returned. Try legacy analysis or refresh later."
        />
        <button type="button" onClick={onUseLegacy} className="mt-3 text-xs text-terminal-cyan hover:underline">
          Use legacy premium analysis
        </button>
      </TerminalWorkspacePage>
    );
  }

  const scenariosOrdered = [...contract.scenarios.scenarios].sort((a, b) => {
    const order = { bull: 0, base: 1, bear: 2 };
    return order[a.name] - order[b.name];
  });

  const isFallback =
    bundle.cacheStatus === "fallback" || bundle.provider.name === "fallback";

  return (
    <TerminalWorkspacePage
      title="Premium Analysis"
      subtitle={`${contract.symbol} - V2 orchestrator`}
      actions={
        <Link
          to={`/company/${encodeURIComponent(ticker)}`}
          className="font-mono text-xs text-terminal-cyan hover:underline"
        >
          - Company
        </Link>
      }
    >
      <CockpitBand>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <TerminalBadge variant={verdictBadgeVariant(contract.executiveVerdict.label)}>
                {contract.executiveVerdict.label}
              </TerminalBadge>
              <TerminalBadge variant="ai">V2</TerminalBadge>
              {isFallback ? (
                <TerminalBadge variant="warning">Deterministic fallback</TerminalBadge>
              ) : null}
            </div>
            <h2 className="text-lg font-semibold text-terminal-text">{contract.executiveVerdict.headline}</h2>
            <p className="max-w-3xl text-sm text-terminal-muted">{contract.executiveVerdict.summary}</p>
          </div>
          <div className="grid gap-1 font-mono text-[10px] text-terminal-muted sm:text-right">
            <span>Generated {formatIso(bundle.generatedAt)}</span>
            <span>
              Cache <span className="text-terminal-cyan">{bundle.cacheStatus}</span> - Provider{" "}
              {bundle.provider.name}
              {bundle.provider.model ? ` (${bundle.provider.model})` : ""}
            </span>
            <span>Snapshot {shortHash(bundle.snapshotHash)} - v{bundle.snapshotVersion}</span>
            <span>
              Confidence {contract.executiveVerdict.confidence}% - Horizon {contract.executiveVerdict.horizonMonths}
              mo
            </span>
          </div>
        </div>
        {isFallback ? (
          <p className="mt-2 text-xs text-amber-200/90" role="status">
            Deterministic fallback - generated without LLM. Treat as educational scaffolding, not full AI synthesis.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-terminal-muted">{contract.executiveVerdict.educationalNote}</p>
      </CockpitBand>

      <details className="rounded border border-terminal-border/80 bg-terminal-bg/30 px-3 py-2 text-xs text-terminal-muted">
        <summary className="cursor-pointer font-mono uppercase tracking-wider text-terminal-cyan">
          Diagnostics
        </summary>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-terminal-muted">cacheStatus</dt>
            <dd className="font-mono text-terminal-text">{bundle.cacheStatus}</dd>
          </div>
          <div>
            <dt className="text-terminal-muted">provider</dt>
            <dd className="font-mono text-terminal-text">
              {bundle.provider.name}
              {bundle.provider.retryCount != null ? ` - retries ${bundle.provider.retryCount}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-terminal-muted">latencyMs</dt>
            <dd className="font-mono text-terminal-text">{bundle.provider.latencyMs ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-terminal-muted">tokens</dt>
            <dd className="font-mono text-terminal-text">
              in {bundle.provider.inputTokens ?? "-"} / out {bundle.provider.outputTokens ?? "-"}
            </dd>
          </div>
        </dl>
      </details>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionBlock title="Data freshness & coverage" accent={TERMINAL_ACCENT_RAIL_AMBER}>
          <p className="text-xs text-terminal-muted">
            Coverage {contract.dataCoverage.length} paths - Missing {contract.missingData.length}
          </p>
          <div className="flex flex-wrap gap-1">
            {contract.dataFreshness.sources.map((src) => (
              <span
                key={src.id}
                className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", statusChipClass(src.status))}
              >
                {src.id}:{src.status}
              </span>
            ))}
          </div>
          {contract.missingData.length > 0 ? (
            <button
              type="button"
              className="text-left text-xs text-terminal-cyan hover:underline"
              onClick={() => setShowMissing((v) => !v)}
            >
              {showMissing ? "Hide" : "Show"} missingData ({contract.missingData.length})
            </button>
          ) : null}
          {showMissing ? (
            <ul className="list-inside list-disc text-xs text-amber-200/90">
              {contract.missingData.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </SectionBlock>

        <SectionBlock title="Business engine">
          <p className="text-sm text-terminal-text">{contract.businessEngine.overview}</p>
          <p className="text-xs text-terminal-muted">{contract.businessEngine.competitiveDynamics}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase text-terminal-muted">Catalysts</p>
              <ul className="list-inside list-disc text-xs text-terminal-text">
                {contract.businessEngine.catalysts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-terminal-muted">Risks</p>
              <ul className="list-inside list-disc text-xs text-terminal-text">
                {contract.businessEngine.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionBlock>
      </div>

      <SectionBlock title="Valuation context">
        <p className="text-sm text-terminal-text">{contract.valuationContext.summary}</p>
        {contract.valuationContext.relativeToPeers ? (
          <p className="text-xs text-terminal-muted">{contract.valuationContext.relativeToPeers}</p>
        ) : null}
        <MetricsTable metrics={contract.valuationContext.metrics} />
      </SectionBlock>

      <SectionBlock title="Technical setup" accent={TERMINAL_ACCENT_RAIL_LIME}>
        <p className="text-sm text-terminal-text">{contract.technicalSetup.summary}</p>
        <p className="text-xs font-mono text-terminal-cyan">{contract.technicalSetup.trend}</p>
        <MetricsTable metrics={contract.technicalSetup.levels} />
        {contract.technicalSetup.momentumNotes ? (
          <p className="text-xs text-terminal-muted">{contract.technicalSetup.momentumNotes}</p>
        ) : null}
      </SectionBlock>

      <SectionBlock title="Scenarios (12m horizon)">
        <div className="grid gap-3 md:grid-cols-3">{scenariosOrdered.map((s) => <ScenarioCard key={s.name} scenario={s} />)}</div>
      </SectionBlock>

      <SectionBlock title="Risk map" accent={TERMINAL_ACCENT_RAIL_AMBER}>
        <p className="text-sm text-terminal-text">{contract.riskMap.summary}</p>
        <ul className="space-y-2">
          {contract.riskMap.items.map((item) => (
            <li
              key={item.id}
              className="rounded border border-terminal-border/70 bg-terminal-bg/20 px-2 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-terminal-text">{item.title}</span>
                <SeverityChip value={item.severity} />
                <SeverityChip value={item.likelihood} />
                <span className="font-mono text-[10px] text-terminal-muted">{item.category}</span>
              </div>
              <p className="mt-1 text-terminal-muted">{item.description}</p>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionBlock title="Historical twins">
          <p className="text-sm text-terminal-text">{contract.historicalTwins.summary}</p>
          {contract.historicalTwins.matchCount === 0 ? (
            <p className="text-xs text-terminal-muted">No validated twin set in this bundle.</p>
          ) : (
            <p className="font-mono text-xs text-terminal-cyan">Matches: {contract.historicalTwins.matchCount}</p>
          )}
          {contract.historicalTwins.avgOutcomePct ? (
            <p className="font-mono text-[10px] text-terminal-muted">
              Avg outcome {contract.historicalTwins.avgOutcomePct.value}% -{" "}
              {contract.historicalTwins.avgOutcomePct.basis}
            </p>
          ) : null}
          <p className="text-xs text-terminal-text">{contract.historicalTwins.lesson}</p>
        </SectionBlock>

        {contract.personalFit ? (
          <SectionBlock title="Personal fit">
            <p className="text-sm text-terminal-text">{contract.personalFit.summary}</p>
            <p className="font-mono text-xs text-terminal-cyan">
              Alignment {contract.personalFit.alignmentScore}/100
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-terminal-muted">Matches</p>
                <ul className="list-inside list-disc text-terminal-text">
                  {contract.personalFit.matches.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-terminal-muted">Mismatches</p>
                <ul className="list-inside list-disc text-terminal-text">
                  {contract.personalFit.mismatches.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
            <ul className="list-inside list-disc text-xs text-terminal-muted">
              {contract.personalFit.suggestedActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </SectionBlock>
        ) : null}
      </div>

      <SectionBlock title="Thesis invalidators">
        <p className="text-sm text-terminal-text">{contract.thesisInvalidators.summary}</p>
        <ul className="space-y-2">
          {contract.thesisInvalidators.items.map((item) => (
            <li key={item.trigger} className="text-xs text-terminal-text">
              <span className="font-medium">{item.trigger}</span>
              <span className="text-terminal-muted"> - impact </span>
              <SeverityChip value={item.impact} />
              <span className="text-terminal-muted"> - monitor {item.monitor}</span>
            </li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock title="Decision note">
        <p className="text-sm text-terminal-text">{contract.decisionNote.note}</p>
        <TerminalBadge variant="default">{contract.decisionNote.stance}</TerminalBadge>
        <ul className="list-inside list-disc text-xs text-terminal-muted">
          {contract.decisionNote.keyQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </SectionBlock>

      <p className="text-center">
        <button
          type="button"
          onClick={onUseLegacy}
          className="font-mono text-[10px] text-terminal-muted hover:text-terminal-cyan"
        >
          Switch to legacy 5-screen premium analysis
        </button>
      </p>

      <InvestmentDisclaimer className="mt-4" />
    </TerminalWorkspacePage>
  );
}
