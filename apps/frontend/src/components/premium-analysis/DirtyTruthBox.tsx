type DirtyTruth = {
  one_liner: string;
  details: string;
  severity: string;
  evidence_link?: string;
};

type DirtyTruthBoxProps = {
  dirtyTruth: DirtyTruth | null;
};

export function DirtyTruthBox({ dirtyTruth }: DirtyTruthBoxProps) {
  return (
    <article className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 p-4">
      <h3 className="text-sm font-semibold uppercase text-brand-amber">The Dirty Truth</h3>
      {dirtyTruth ? (
        <>
          <p className="mt-2 text-sm font-semibold text-white">{dirtyTruth.one_liner}</p>
          <p className="mt-2 text-xs text-slate-300">{dirtyTruth.details}</p>
          <p className="mt-1 text-xs text-slate-500">Severity: {dirtyTruth.severity}</p>
          {dirtyTruth.evidence_link ? (
            <a href={dirtyTruth.evidence_link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brand-blue hover:underline">
              Source
            </a>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-200">No hidden red flags detected.</p>
      )}
    </article>
  );
}
