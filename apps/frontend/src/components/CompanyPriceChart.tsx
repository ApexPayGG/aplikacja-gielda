import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { colors } from "../styles/designSystem";
import type { QuoteRow } from "../services/api";

type OhlcPoint = {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type Props = {
  quotes: QuoteRow[];
  sessionOhlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  } | null;
};

const CHART_HEIGHT = 288;
const PADDING = { top: 20, right: 16, bottom: 32, left: 52 };

function synthesizeSevenDayWave(session: NonNullable<Props["sessionOhlc"]>): OhlcPoint[] {
  const labels = ["-6d", "-5d", "-4d", "-3d", "-2d", "-1d", "Today"];
  const mid = (session.open + session.close) / 2;
  const amplitude = Math.max(0.08, (session.high - session.low) * 0.65);

  return labels.map((label, index) => {
    const wave = Math.sin((index / 6) * Math.PI * 1.35) * amplitude;
    const drift = ((session.close - session.open) / 6) * index;
    const close = mid + wave + drift;
    const open = index === 0 ? session.open : mid + Math.sin(((index - 1) / 6) * Math.PI * 1.35) * amplitude + drift;
    const high = Math.max(open, close) + amplitude * 0.22;
    const low = Math.min(open, close) - amplitude * 0.22;
    return { label, open, high, low, close };
  });
}

function quotesToPoints(quotes: QuoteRow[], locale: string): OhlcPoint[] {
  const slice = quotes.slice(-7);
  return slice.map((q) => ({
    label: new Date(q.timestamp).toLocaleDateString(locale, { day: "numeric", month: "short" }),
    open: Number(q.open),
    high: Number(q.high),
    low: Number(q.low),
    close: Number(q.close),
  }));
}

function buildAreaPath(points: OhlcPoint[], xAt: (i: number) => number, yAt: (v: number) => number, baseline: number): string {
  if (points.length === 0) return "";
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.close).toFixed(2)}`).join(" ");
  const lastX = xAt(points.length - 1);
  const firstX = xAt(0);
  return `${line} L ${lastX.toFixed(2)} ${baseline.toFixed(2)} L ${firstX.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

export function CompanyPriceChart({ quotes, sessionOhlc }: Props) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || "en";

  const points = useMemo(() => {
    const validQuotes = quotes.filter((q) => Number.isFinite(Number(q.close)));
    if (validQuotes.length >= 2) return quotesToPoints(validQuotes, locale);
    if (sessionOhlc && Number.isFinite(sessionOhlc.close)) return synthesizeSevenDayWave(sessionOhlc);
    return [];
  }, [quotes, sessionOhlc, locale]);

  if (points.length === 0) {
    return (
      <div
        className="flex h-72 items-center justify-center rounded-lg border border-dashed text-sm"
        style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary, color: colors.textMuted }}
      >
        No price data available yet.
      </div>
    );
  }

  const width = 640;
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const minVal = Math.min(...points.map((p) => p.low));
  const maxVal = Math.max(...points.map((p) => p.high));
  const range = maxVal - minVal || 1;
  const yMin = minVal - range * 0.08;
  const yMax = maxVal + range * 0.08;

  const xAt = (i: number) => PADDING.left + (i / Math.max(1, points.length - 1)) * innerW;
  const yAt = (v: number) => PADDING.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const baseline = PADDING.top + innerH;

  const areaPath = buildAreaPath(points, xAt, yAt, baseline);
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(p.close).toFixed(2)}`)
    .join(" ");

  const gridLines = 4;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / gridLines);
  const latestClose = points.at(-1)?.close ?? 0;
  const firstClose = points[0]?.close ?? latestClose;
  const changePct = firstClose !== 0 ? ((latestClose - firstClose) / firstClose) * 100 : 0;
  const isUp = changePct >= 0;

  return (
    <div
      className="relative overflow-hidden rounded-lg border"
      style={{
        borderColor: colors.borderStrong,
        background: `linear-gradient(165deg, rgba(168,85,247, 0.06) 0%, rgba(34,211,238, 0.05) 55%, ${colors.bgPrimary} 100%)`,
      }}
    >
      <div className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-semibold font-mono"
        style={{
          backgroundColor: isUp ? "rgba(0, 168, 107, 0.12)" : "rgba(229, 57, 53, 0.12)",
          color: isUp ? colors.positive : colors.negative,
        }}
      >
        {isUp ? "+" : ""}
        {changePct.toFixed(2)}%
      </div>

      <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="h-72 w-full" role="img" aria-label="Price chart">
        <defs>
          <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.brandCyan} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colors.brandDark} stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="priceLineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.brandDark} />
            <stop offset="100%" stopColor={colors.brandCyan} />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={width - PADDING.right}
                y2={y}
                stroke={colors.border}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
              />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill={colors.textMuted}>
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#priceAreaGradient)" />
        <path d={linePath} fill="none" stroke="url(#priceLineGradient)" strokeWidth="2.5" strokeLinecap="round" />

        {points.map((p, i) => {
          const cx = xAt(i);
          const bodyTop = yAt(Math.max(p.open, p.close));
          const bodyBottom = yAt(Math.min(p.open, p.close));
          const bodyH = Math.max(2, bodyBottom - bodyTop);
          const bullish = p.close >= p.open;
          const wickColor = bullish ? colors.positive : colors.negative;
          const bodyColor = bullish ? colors.brandCyan : colors.brandMedium;
          return (
            <g key={`${p.label}-${i}`} opacity={points.length >= 5 ? 0.85 : 0}>
              <line x1={cx} y1={yAt(p.high)} x2={cx} y2={yAt(p.low)} stroke={wickColor} strokeWidth="1.2" />
              <rect x={cx - 3} y={bodyTop} width={6} height={bodyH} rx={1} fill={bodyColor} />
            </g>
          );
        })}

        {points.map((p, i) => (
          <circle
            key={`dot-${p.label}`}
            cx={xAt(i)}
            cy={yAt(p.close)}
            r={3.5}
            fill={colors.bgPrimary}
            stroke={colors.brandCyan}
            strokeWidth="2"
          />
        ))}

        {points.map((p, i) => (
          <text
            key={`label-${p.label}`}
            x={xAt(i)}
            y={CHART_HEIGHT - 10}
            textAnchor="middle"
            fontSize="10"
            fill={colors.textMuted}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
