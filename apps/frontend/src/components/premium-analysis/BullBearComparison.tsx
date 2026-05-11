type BullBearComparisonProps = {
  bullNarrative: string;
  bearNarrative: string;
};

export function BullBearComparison({ bullNarrative, bearNarrative }: BullBearComparisonProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="rounded-xl border border-brand-green/40 bg-brand-green/10 p-4">
        <h3 className="text-sm font-semibold uppercase text-brand-green">Bull Case</h3>
        <p className="mt-2 text-sm text-slate-200">{bullNarrative}</p>
      </article>
      <article className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-4">
        <h3 className="text-sm font-semibold uppercase text-brand-red">Bear Case</h3>
        <p className="mt-2 text-sm text-slate-200">{bearNarrative}</p>
      </article>
    </div>
  );
}
