import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  previewDailyDigest,
  sendDailyDigest,
  type DailyDigestResponse,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";

export function DigestPage() {
  const { t, i18n } = useTranslation();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<DailyDigestResponse | null>(null);
  const [sentInfo, setSentInfo] = useState<string | null>(null);

  async function onPreview(): Promise<void> {
    setLoadingPreview(true);
    setError(null);
    setSentInfo(null);
    try {
      const lang = (i18n.resolvedLanguage || i18n.language || "pl").trim();
      const payload = await previewDailyDigest(USER_ID, lang || "pl");
      setDigest(payload);
    } catch (e) {
      setError(apiErrorMessage(e));
      setDigest(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onSendTest(): Promise<void> {
    setSending(true);
    setError(null);
    try {
      const lang = (i18n.resolvedLanguage || i18n.language || "pl").trim();
      const payload = await sendDailyDigest(USER_ID, lang || "pl");
      setDigest(payload);
      setSentInfo(t("digest.emailSent", { date: payload.date }));
    } catch (e) {
      setError(apiErrorMessage(e));
      setSentInfo(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-white">{t("digest.title")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("digest.subtitle")}</p>
        </header>

        {error ? (
          <div className="rounded border border-brand-red/30 bg-brand-red/10 p-3 text-sm text-brand-red">
            {error}
          </div>
        ) : null}

        {sentInfo ? (
          <div className="rounded border border-brand-blue/30 bg-brand-blue/10 p-3 text-sm text-brand-blue">
            {sentInfo}
          </div>
        ) : null}

        <section className="neo-panel flex flex-wrap gap-3 rounded-xl p-4">
          <button
            type="button"
            onClick={onPreview}
            disabled={loadingPreview}
            className="rounded bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/85 disabled:opacity-60"
          >
            {loadingPreview ? t("common.loading") : t("digest.previewButton")}
          </button>

          <button
            type="button"
            onClick={onSendTest}
            disabled={sending}
            className="rounded bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-bg hover:bg-brand-amber/85 disabled:opacity-60"
          >
            {sending ? t("common.loading") : t("digest.sendButton")}
          </button>
        </section>

        {digest ? (
          <section className="neo-panel rounded-2xl border border-brand-blue/20 p-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("digest.cardDateLabel")}</p>
            <p className="mt-1 text-sm text-slate-300">{digest.date}</p>
            <p className="mt-4 text-lg leading-relaxed text-slate-100">{digest.digest}</p>
          </section>
        ) : (
          <section className="neo-panel rounded-2xl border border-brand-border p-6 text-sm text-slate-400">
            {t("digest.emptyState")}
          </section>
        )}
      </div>
    </div>
  );
}
