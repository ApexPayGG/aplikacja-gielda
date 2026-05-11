type ActionButtonsProps = {
  onPreMortem: () => void;
  onMirrorTrade?: () => void;
};

export function ActionButtons({ onPreMortem, onMirrorTrade }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPreMortem}
        className="rounded-lg border border-brand-blue/60 bg-brand-blue/20 px-3 py-2 text-sm text-brand-blue"
      >
        Run Pre-Mortem
      </button>
      <button
        type="button"
        onClick={onMirrorTrade}
        className="rounded-lg border border-brand-green/60 bg-brand-green/20 px-3 py-2 text-sm text-brand-green"
      >
        Mirror trade from analysis
      </button>
    </div>
  );
}
