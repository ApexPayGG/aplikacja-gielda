export interface SectorHeatmapProps {
  sectorData: Record<string, number>;
  selectedSymbolSector: string;
}

function heatColor(score: number, min: number, max: number): string {
  if (max <= min) return "rgba(59, 130, 246, 0.35)";
  const t = (score - min) / (max - min);
  const alpha = 0.25 + t * 0.55;
  return `rgba(59, 130, 246, ${alpha})`;
}

/** Siatka sektorów — intensywność = średni safety score; podświetlenie sektora symbolu. */
export function SectorHeatmap({ sectorData, selectedSymbolSector }: SectorHeatmapProps) {
  const entries = Object.entries(sectorData).sort(([a], [b]) => a.localeCompare(b));
  const values = entries.map(([, v]) => v);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 100;
  const selected = selectedSymbolSector.trim();

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated/50 p-8 text-center text-sm text-slate-500">
        Brak danych sektorów (wczytaj porównanie).
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-surface-border bg-surface-elevated p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Sector heatmap</h2>
      <p className="mt-1 text-xs text-slate-500">Średni safety score per sektor (ciemniejszy = wyższy).</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.map(([sector, score]) => {
          const isSelected = sector === selected;
          return (
            <div
              key={sector}
              className={`rounded-md border px-3 py-3 text-sm transition ${
                isSelected ? "border-accent ring-1 ring-accent" : "border-surface-border"
              }`}
              style={{ backgroundColor: heatColor(score, min, max) }}
            >
              <div className="font-medium text-white">{sector}</div>
              <div className="mt-1 font-mono text-xs text-slate-200">{score.toFixed(1)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
