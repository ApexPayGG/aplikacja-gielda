import { useMemo, useState } from "react";
import { colors } from "../styles/designSystem";
import {
  TERMINAL_TOOL_CARD,
  TERMINAL_TOOL_PAGE,
  TERMINAL_TOOL_PAGE_INNER,
  TERMINAL_TOOL_PANEL,
} from "../components/terminal/terminalStyles";

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
    <div className={TERMINAL_TOOL_PAGE}>
      <div className={`${TERMINAL_TOOL_PAGE_INNER} max-w-7xl`}>
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-terminal-cyan">Risk analytics</p>
        <h1 className="text-3xl font-bold tracking-tight text-terminal-text">Volatility Heat Map</h1>
        <p className="text-sm text-terminal-textMuted">
          Explore monthly volatility by sector and quickly spot concentration of risk through a visual calendar map.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <article className={TERMINAL_TOOL_PANEL}>
          <h2 className="mb-3 text-base font-semibold text-terminal-cyan">
            Calendar heat map (12 months x sectors)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-[920px] border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs uppercase text-terminal-textMuted">
                    Sector
                  </th>
                  {MONTHS.map((month) => (
                    <th key={month} className="px-2 py-1 text-center text-xs uppercase text-terminal-textMuted">
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTORS.map((sector, sectorIndex) => (
                  <tr key={sector}>
                    <th className="px-2 py-1 text-left text-xs text-terminal-textSecondary">
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-terminal-textMuted">
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
            <div className="grid grid-cols-5 gap-2 text-center text-[11px] text-terminal-textMuted">
              <span>Very low</span>
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Very high</span>
            </div>
          </div>
        </article>

        <aside className={TERMINAL_TOOL_PANEL}>
          <h2 className="mb-3 text-base font-semibold text-terminal-cyan">
            Selected month + sector details
          </h2>
          <div className={TERMINAL_TOOL_CARD}>
            <div className="text-xs uppercase tracking-wide text-terminal-textMuted">
              Month
            </div>
            <div className="mt-1 text-lg font-semibold text-terminal-text">
              {MONTHS[selectedMonthIndex]}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-terminal-textMuted">
              Sector
            </div>
            <div className="mt-1 text-lg font-semibold text-terminal-text">
              {SECTORS[selectedSectorIndex]}
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-terminal-textMuted">
              Volatility
            </div>
            <div className="mt-1 text-lg font-mono font-semibold text-terminal-negative">
              {(selectedValue * 100).toFixed(1)}%
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-terminal-textMuted">
              Level
            </div>
            <div className="mt-1 text-sm font-medium text-terminal-textSecondary">
              {levelLabel(selectedValue)}
            </div>
            <div className="mt-4 h-2 rounded-full bg-terminal-panelSecondary">
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
    </div>
  );
}
