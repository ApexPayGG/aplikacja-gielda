type VerdictScoreCircleProps = {
  score: number;
  label: string;
};

function scoreColor(score: number): string {
  if (score >= 81) return "#22c55e";
  if (score >= 61) return "#3b82f6";
  if (score >= 41) return "#f59e0b";
  return "#ef4444";
}

export function VerdictScoreCircle({ score, label }: VerdictScoreCircleProps) {
  const safeScore = Math.min(100, Math.max(0, Math.round(score)));
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const progress = (safeScore / 100) * circumference;
  const color = scoreColor(safeScore);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
        <circle cx="80" cy="80" r={radius} stroke="#334155" strokeWidth="12" fill="none" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="82" textAnchor="middle" className="fill-white text-3xl font-extrabold">
          {safeScore}
        </text>
      </svg>
      <p className="mt-2 text-sm font-semibold text-slate-200">{label}</p>
    </div>
  );
}
