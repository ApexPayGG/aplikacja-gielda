import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getStrategyDna, type StrategyDnaResponse } from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

function legendLabel(name: StrategyDnaResponse["primary"]["name"]): string {
  if (name === "BUFFETT") return "Buffett";
  if (name === "LYNCH") return "Lynch";
  if (name === "GREENBLATT") return "Graham";
  return "Soros";
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

type SetupItem = {
  name: string;
  frequency: number;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function investorMatchPct(
  data: StrategyDnaResponse,
  target: StrategyDnaResponse["primary"]["name"],
  fallback: number,
): number {
  if (data.primary.name === target) return clampPercent(data.primary.pct);
  if (data.secondary.name === target) return clampPercent(data.secondary.pct);
  return clampPercent(fallback);
}

function buildSetups(data: StrategyDnaResponse): SetupItem[] {
  const sectors = data.stats.preferredSectors ?? [];
  if (sectors.length > 0) {
    return sectors.slice(0, 4).map((sector, index) => ({
      name: `Setup sektorowy: ${sector}`,
      frequency: clampPercent(74 - index * 14),
    }));
  }

  return [
    { name: "Mean reversion po gwałtownym spadku", frequency: 62 },
    { name: "Kontynuacja trendu po wybiciu", frequency: 51 },
    { name: "Setup defensywny na wysokiej zmienności", frequency: 37 },
  ];
}

export function StrategyDnaPage() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<StrategyDnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromMistakes = searchParams.get("from") === "mistakes";
  const highlightSymbols = useMemo(() => {
    const one = searchParams.get("symbol")?.trim().toUpperCase();
    if (one) return [one];
    const raw = searchParams.get("symbols") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStrategyDna(USER_ID);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(apiErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 text-textPrimary">
      <header
        className="rounded-3xl border border-border bg-bgPrimary p-6 shadow-[0_18px_45px_rgba(45,10,107,0.1)]"
        style={{ background: `linear-gradient(130deg, ${colors.bgPrimary}, ${colors.bgSecondary})` }}
      >
        <h1 className="text-3xl font-bold text-brandDark">Strategy DNA</h1>
        <p className="mt-2 text-sm text-textSecondary">Poznaj wzorce decyzji i dominujący styl inwestowania.</p>
      </header>

      {fromMistakes && highlightSymbols.length > 0 ? (
        <div className="rounded-xl border border-brandGold/45 bg-brandGold/10 px-4 py-3 text-sm text-textPrimary">
          <p className="font-semibold text-brandDark">Kontekst z biblioteki błędów</p>
          <p className="mt-1 text-textSecondary">Symbole z błędów: {highlightSymbols.join(", ")}.</p>
        </div>
      ) : null}

      {loading && <p className="text-sm text-textMuted">Ładowanie...</p>}
      {error && <p className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-3 text-sm font-medium text-negative">{error}</p>}

      {!loading && !error && data && (
        <>
          {data.hasEnoughData ? (
            <section className="rounded-2xl border border-border bg-bgPrimary p-6 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
              <h2 className="text-lg font-semibold text-brandDark">Twój styl inwestowania</h2>
              <div className="mt-5 grid gap-6 md:grid-cols-[260px_1fr]">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-bgSecondary p-5">
                  <div
                    className="flex h-44 w-44 flex-col items-center justify-center rounded-full text-center text-white shadow-[0_12px_30px_rgba(45,10,107,0.35)]"
                    style={{ backgroundColor: colors.brandDark }}
                  >
                    <p className="text-xs uppercase tracking-wide text-white/75">Dominant style</p>
                    <p className="mt-1 text-xl font-bold">{legendLabel(data.primary.name)}</p>
                    <p className="text-sm font-semibold">{pct(data.primary.pct)}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <MatchBar
                    label="Lynch"
                    value={investorMatchPct(data, "LYNCH", data.stats.winRate * 0.85)}
                  />
                  <MatchBar
                    label="Buffett"
                    value={investorMatchPct(data, "BUFFETT", 100 - data.stats.riskTolerance)}
                  />
                  <MatchBar
                    label="Graham"
                    value={investorMatchPct(data, "GREENBLATT", data.stats.winRate * 0.75)}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-brandGold/40 bg-brandGold/10 p-6 text-center">
              <p className="text-lg font-semibold text-brandDark">Potrzebujesz co najmniej 20 zamkniętych transakcji.</p>
            </section>
          )}

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
              <h3 className="text-lg font-semibold text-brandDark">Twoje setup-y</h3>
              <ul className="mt-4 space-y-3">
                {buildSetups(data).map((setup) => (
                  <li key={setup.name} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bgSecondary px-3 py-2.5">
                    <span className="text-sm font-medium text-textPrimary">{setup.name}</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${colors.brandDark}16`, color: colors.brandDark }}
                    >
                      {setup.frequency}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
              <h3 className="text-lg font-semibold text-brandDark">AI insight</h3>
              <p className="mt-3 text-sm leading-6 text-textSecondary">{data.insight}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <StatTile label="Win rate" value={pct(data.stats.winRate)} />
                <StatTile label="Avg holding" value={`${Math.round(data.stats.avgHoldingDays)} dni`} />
                <StatTile label="Śr. zysk" value={`${data.stats.avgWinPct.toFixed(1)}%`} />
                <StatTile label="Śr. strata" value={`${data.stats.avgLossPct.toFixed(1)}%`} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-bgPrimary p-5 shadow-[0_14px_34px_rgba(45,10,107,0.08)]">
            <h3 className="text-lg font-semibold text-brandDark">Rekomendacje</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <RecommendationCard
                title="Graj pod swój dominant style"
                body={`Najwyższe dopasowanie to ${legendLabel(data.primary.name)} (${pct(data.primary.pct)}). Buduj checklistę pod ten profil.`}
              />
              <RecommendationCard
                title="Rotuj setupy sektorowe"
                body="Skup się na 2-3 setupach, które powtarzają się najczęściej i notuj ich skuteczność tydzień do tygodnia."
              />
              <RecommendationCard
                title="Pilnuj ryzyka pozycji"
                body={`Aktualna tolerancja ryzyka to ${pct(data.stats.riskTolerance)}. Utrzymuj wielkość pozycji spójną z planem.`}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MatchBar(props: { label: string; value: number }) {
  const width = clampPercent(props.value);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-textPrimary">{props.label}</span>
        <span className="font-semibold text-brandDark">{width}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bgTertiary">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: colors.brandCyan }} />
      </div>
    </div>
  );
}

function StatTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bgSecondary p-3">
      <p className="text-xs text-textMuted">{props.label}</p>
      <p className="mt-1 font-semibold text-brandDark">{props.value}</p>
    </div>
  );
}

function RecommendationCard(props: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-border bg-bgPrimary p-4 shadow-[0_10px_24px_rgba(45,10,107,0.08)]" style={{ borderLeft: `4px solid ${colors.brandCyan}` }}>
      <h4 className="text-sm font-semibold text-brandDark">{props.title}</h4>
      <p className="mt-2 text-sm leading-6 text-textSecondary">{props.body}</p>
    </article>
  );
}
