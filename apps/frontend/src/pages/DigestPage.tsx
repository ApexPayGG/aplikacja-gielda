import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  previewDailyDigest,
  sendDailyDigest,
  type DailyDigestResponse,
} from "../services/api";
import {
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_INFO_BANNER,
  TERMINAL_INSIGHT_CARD,
  TERMINAL_INTELLIGENCE_CARD,
  TERMINAL_INTELLIGENCE_PAGE,
  TERMINAL_INTELLIGENCE_PAGE_INNER,
  TERMINAL_INTELLIGENCE_PANEL,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_TOGGLE_THUMB,
  TERMINAL_TOGGLE_TRACK,
} from "../components/terminal/terminalStyles";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const USER_ID = window.localStorage.getItem("userId")?.trim() || "";
type Frequency = "daily" | "weekly";

function upsertHistory(
  previous: DailyDigestResponse[],
  incoming: DailyDigestResponse,
): DailyDigestResponse[] {
  const deduped = previous.filter(
    (item) => !(item.date === incoming.date && item.digest === incoming.digest),
  );
  return [incoming, ...deduped].slice(0, 10);
}

function digestPreview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

export function DigestPage() {
  const { t, i18n } = useTranslation();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<DailyDigestResponse | null>(null);
  const [sentInfo, setSentInfo] = useState<string | null>(null);
  const [history, setHistory] = useState<DailyDigestResponse[]>([]);
  const [subscribed, setSubscribed] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>("daily");

  async function onPreview(): Promise<void> {
    setLoadingPreview(true);
    setError(null);
    setSentInfo(null);
    try {
      const lang = (i18n.resolvedLanguage || i18n.language || "pl").trim();
      const payload = await previewDailyDigest(USER_ID, lang || "pl");
      setDigest(payload);
      setHistory((prev) => upsertHistory(prev, payload));
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
      setHistory((prev) => upsertHistory(prev, payload));
      setSentInfo(t("digest.emailSent", { date: payload.date }));
    } catch (e) {
      setError(apiErrorMessage(e));
      setSentInfo(null);
    } finally {
      setSending(false);
    }
  }

  const previousDigests = history.slice(digest ? 1 : 0);

  return (
    <div className={TERMINAL_INTELLIGENCE_PAGE}>
      <div className={TERMINAL_INTELLIGENCE_PAGE_INNER}>
        <header className="space-y-2">
          <h1 className={TERMINAL_PAGE_TITLE}>Daily Digest</h1>
          <p className={TERMINAL_PAGE_SUBTITLE}>
            Codzienny skrot najwazniejszych informacji inwestycyjnych i sygnalow rynku.
          </p>
        </header>

        {error ? <div className={TERMINAL_DANGER_PANEL}>{error}</div> : null}

        {sentInfo ? <div className={TERMINAL_INFO_BANNER}>{sentInfo}</div> : null}

        <section className={TERMINAL_INTELLIGENCE_PANEL}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-terminal-textSecondary">Subscribe</span>
              <button
                type="button"
                role="switch"
                aria-checked={subscribed}
                onClick={() => setSubscribed((prev) => !prev)}
                className={`${TERMINAL_TOGGLE_TRACK} ${
                  subscribed ? "border-terminal-cyan/50 bg-terminal-cyan/20" : "border-terminal-borderMuted bg-terminal-panelSecondary"
                }`}
              >
                <span
                  className={`${TERMINAL_TOGGLE_THUMB} ${subscribed ? "translate-x-[2.125rem]" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(["daily", "weekly"] as const).map((option) => {
                const active = frequency === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFrequency(option)}
                    className={active ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                  >
                    {option === "daily" ? "Daily" : "Weekly"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={onPreview} disabled={loadingPreview} className={TERMINAL_BUTTON_PRIMARY}>
              {loadingPreview ? t("common.loading") : t("digest.sendNow", { defaultValue: "Send now" })}
            </button>

            <button
              type="button"
              onClick={onSendTest}
              disabled={sending || !subscribed}
              className={TERMINAL_BUTTON_SECONDARY}
            >
              {sending ? t("common.loading") : `${t("digest.sendButton")} (${frequency === "daily" ? "Daily" : "Weekly"})`}
            </button>
          </div>
        </section>

        {digest ? (
          <section className={TERMINAL_INSIGHT_CARD}>
            <p className="text-xs uppercase tracking-wide text-terminal-textMuted">{t("digest.todayLabel")}</p>
            <p className="mt-1 text-sm text-terminal-textSecondary">{digest.date}</p>
            <p className="mt-4 text-lg leading-relaxed text-terminal-text">{digest.digest}</p>
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-terminal-borderMuted bg-terminal-panelSecondary/60 p-8 text-center text-sm text-terminal-textMuted">
            {t("digest.emptyState")}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-terminal-textSecondary">
            {t("digest.previousSectionTitle")}
          </h2>
          {previousDigests.length > 0 ? (
            previousDigests.map((entry) => (
              <article key={`${entry.date}-${entry.digest.slice(0, 16)}`} className={TERMINAL_INTELLIGENCE_CARD}>
                <p className="text-xs font-semibold uppercase tracking-wide text-terminal-cyan">{entry.date}</p>
                <p className="mt-2 text-sm text-terminal-textSecondary">{digestPreview(entry.digest)}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-terminal-textMuted">{t("digest.noPreviousDigests")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
