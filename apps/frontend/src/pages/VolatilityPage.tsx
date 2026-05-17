import { useMemo, useState } from "react";
import { colors } from "../styles/designSystem";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const SECTORS = ["Energy", "Technology", "Financials", "Healthcare", "Industrials", "Utilities"] as const;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function blendHex(from: string, to: string, ratio: number): string {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const [fr, fg, fb] = hexToRgb(from);
  const [tr, tg, tb] = hexToRgb(to);
  const r = Math.round(fr + (tr - fr) * safeRatio);
  const g = Math.round(fg + (tg - fg) * safeRatio);
  const b = Math.round(fb + (tb - fb) * safeRatio);
  return `rgb(${r}, ${g}, ${b})`;
}

function levelLabel(value: number): string {
  if (value < 0.2) return "Very low";
  if (value < 0.4) return "Low";
  if (value < 0.6) return "Medium";
  if (value < 0.8) return "High";
  return "Very high";
}

export function VolatilityPage() {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [selectedSectorIndex, setSelectedSectorIndex] = useState(0);

  const heatmap = useMemo(
    () =>
      SECTORS.map((_, sectorIndex) =>
        MONTHS.map((_, monthIndex) => {
          const raw = (monthIndex * 17 + sectorIndex * 11 + 13) % 100;
          return Number((raw / 100).toFixed(2));
        }),
      ),
    [],
  );

  const selectedValue = heatmap[selectedSectorIndex][selectedMonthIndex];
  const selectedCellColor = blendHex(colors.bgSecondary, colors.negative, selectedValue);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10" style={{ color: colors.textPrimary }}>
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.brandDark }}>
          Volatility Heat Map
        </h1>
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          Explore monthly volatility by sector and quickly spot concentration of risk through a visual calendar map.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
            Calendar heat map (12 months x sectors)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-[920px] border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs uppercase" style={{ color: colors.textMuted }}>
                    Sector
                  </th>
                  {MONTHS.map((month) => (
                    <th key={month} className="px-2 py-1 text-center text-xs uppercase" style={{ color: colors.textMuted }}>
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTORS.map((sector, sectorIndex) => (
                  <tr key={sector}>
                    <th className="px-2 py-1 text-left text-xs" style={{ color: colors.textSecondary }}>
                      {sector}
                    </th>
                    {MONTHS.map((month, monthIndex) => {
                      const value = heatmap[sectorIndex][monthIndex];
                      const active = selectedMonthIndex === monthIndex && selectedSectorIndex === sectorIndex;
                      return (
                        <td key={`${sector}-${month}`} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonthIndex(monthIndex);
                              setSelectedSectorIndex(sectorIndex);
                            }}
                            className="h-10 w-14 rounded-lg border text-xs font-medium transition hover:opacity-90"
                            style={{
                              borderColor: active ? colors.brandDark : colors.border,
                              backgroundColor: blendHex(colors.bgSecondary, colors.negative, value),
                              color: value > 0.55 ? colors.bgPrimary : colors.textPrimary,
                            }}
                          >
                            {Math.round(value * 100)}%
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Legenda (5 poziomow)
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {[0, 0.25, 0.5, 0.75, 1].map((point, index) => (
                <div
                  key={point}
                  className="rounded-lg border px-2 py-2 text-center text-[11px] font-medium"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: blendHex(colors.bgSecondary, colors.negative, point),
                    color: point > 0.55 ? colors.bgPrimary : colors.textPrimary,
                  }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-[11px]" style={{ color: colors.textMuted }}>
              <span>Very low</span>
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Very high</span>
            </div>
          </div>
        </article>

        <aside className="rounded-2xl border p-5" style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}>
          <h2 className="mb-3 text-base font-semibold" style={{ color: colors.brandDark }}>
            Selected month + sector details
          </h2>
          <div className="rounded-xl border p-4" style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgSecondary }}>
            <div className="text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Month
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: colors.brandDark }}>
              {MONTHS[selectedMonthIndex]}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Sector
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: colors.brandDark }}>
              {SECTORS[selectedSectorIndex]}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Volatility
            </div>
            <div className="mt-1 text-lg font-mono font-semibold" style={{ color: colors.negative }}>
              {(selectedValue * 100).toFixed(1)}%
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide" style={{ color: colors.textMuted }}>
              Level
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: colors.textSecondary }}>
              {levelLabel(selectedValue)}
            </div>
            <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: colors.bgTertiary }}>
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max(4, selectedValue * 100)}%`,
                  backgroundColor: selectedCellColor,
                }}
              />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
