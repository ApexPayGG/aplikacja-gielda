import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  generateTrackRecord,
  getPublicTrackRecord,
  type TrackRecordPublicResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = "demo-user";

export function TrackRecordPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicHash, setPublicHash] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TrackRecordPublicResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = publicHash ? `stock-ai.pro/track-record/public/${publicHash}` : null;

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const generated = await generateTrackRecord(USER_ID);
      const publicMetrics = await getPublicTrackRecord(generated.publicHash);
      setPublicHash(generated.publicHash);
      setMetrics(publicMetrics);
    } catch (e) {
      setPublicHash(null);
      setMetrics(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCopyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(t("trackrecord.copyFailed"));
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-bold text-white">{t("trackrecord.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("trackrecord.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        <section className="neo-panel rounded-xl p-4">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loading ? t("common.loading") : t("trackrecord.generateButton")}
          </button>
        </section>

        {metrics && shareUrl ? (
          <section className="neo-panel rounded-xl p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">{t("trackrecord.cardTitle")}</h2>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Metric label={t("trackrecord.winRate")} value={`${metrics.winRate.toFixed(2)}%`} />
              <Metric label={t("trackrecord.totalTrades")} value={String(metrics.totalTrades)} />
              <Metric label={t("trackrecord.avgReturn")} value={`${metrics.avgReturn.toFixed(2)}%`} />
              <Metric
                label={t("trackrecord.bestTradePct")}
                value={`${metrics.bestTradePct >= 0 ? "+" : ""}${metrics.bestTradePct.toFixed(2)}%`}
              />
              <Metric
                label={t("trackrecord.worstTradePct")}
                value={`${metrics.worstTradePct >= 0 ? "+" : ""}${metrics.worstTradePct.toFixed(2)}%`}
              />
              <Metric
                label={t("trackrecord.generatedAt")}
                value={new Date(metrics.generatedAt).toLocaleString()}
              />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-slate-300">
                {t("trackrecord.shareLinkLabel")}: <span className="font-mono">{shareUrl}</span>
              </p>
              <button
                type="button"
                onClick={onCopyLink}
                className="rounded bg-brand-amber px-4 py-2 font-semibold text-brand-bg hover:bg-brand-amber/85"
              >
                {copied ? t("trackrecord.copied") : t("trackrecord.copyButton")}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-brand-border bg-brand-bg/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{props.label}</p>
      <p className="mt-1 text-base font-semibold text-white">{props.value}</p>
    </div>
  );
}
