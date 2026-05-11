type ScreenNavigatorProps = {
  current: number;
  onChange: (next: number) => void;
  max: number;
  lockedFrom?: number;
};

export function ScreenNavigator({ current, onChange, max, lockedFrom }: ScreenNavigatorProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-elevated p-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current <= 1}
        className="rounded-lg border border-surface-border px-3 py-1 text-sm text-slate-300 disabled:opacity-50"
      >
        ← Prev
      </button>
      <div className="flex items-center gap-2">
        {Array.from({ length: max }, (_, idx) => idx + 1).map((n) => {
          const locked = lockedFrom != null && n >= lockedFrom;
          return (
            <button
              key={n}
              type="button"
              onClick={() => !locked && onChange(n)}
              disabled={locked}
              className={`h-8 w-8 rounded-full border text-xs font-semibold ${
                current === n
                  ? "border-brand-blue bg-brand-blue/20 text-brand-blue"
                  : locked
                    ? "cursor-not-allowed border-slate-700 bg-slate-900/50 text-slate-500"
                    : "border-slate-700 bg-slate-900/60 text-slate-300"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, current + 1))}
        disabled={current >= max || (lockedFrom != null && current + 1 >= lockedFrom)}
        className="rounded-lg border border-surface-border px-3 py-1 text-sm text-slate-300 disabled:opacity-50"
      >
        Next →
      </button>
    </div>
  );
}
