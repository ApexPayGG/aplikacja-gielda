import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  previewDailyDigest,
  sendDailyDigest,
  type DailyDigestResponse,
} from "../services/api";
import { colors } from "../styles/designSystem";
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
    <div className="min-h-screen" style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold" style={{ color: colors.brandDark }}>
            Daily Digest
          </h1>
          <p className="text-sm md:text-base" style={{ color: colors.textSecondary }}>
            Codzienny skrot najwazniejszych informacji inwestycyjnych i sygnalow rynku.
          </p>
        </header>

        {error ? (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: colors.negative, backgroundColor: colors.bgPrimary, color: colors.negative }}
          >
            {error}
          </div>
        ) : null}

        {sentInfo ? (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: colors.brandCyan, backgroundColor: colors.bgPrimary, color: colors.brandDark }}
          >
            {sentInfo}
          </div>
        ) : null}

        <section
          className="rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
                Subscribe
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={subscribed}
                onClick={() => setSubscribed((prev) => !prev)}
                className="relative h-7 w-14 rounded-full border transition-colors"
                style={{
                  backgroundColor: subscribed ? colors.brandCyan : colors.bgTertiary,
                  borderColor: subscribed ? colors.brandCyan : colors.borderStrong,
                }}
              >
                <span
                  className="absolute top-0.5 rounded-full bg-white transition-transform"
                  style={{
                    width: "22px",
                    height: "22px",
                    transform: subscribed ? "translateX(30px)" : "translateX(2px)",
                  }}
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
                    className="rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors"
                    style={{
                      backgroundColor: active ? colors.brandDark : colors.bgTertiary,
                      color: active ? colors.bgPrimary : colors.textSecondary,
                      border: `1px solid ${active ? colors.brandDark : colors.borderStrong}`,
                    }}
                  >
                    {option === "daily" ? "Daily" : "Weekly"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onPreview}
              disabled={loadingPreview}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: colors.brandDark }}
            >
              {loadingPreview ? t("common.loading") : "Wyślij teraz"}
            </button>

            <button
              type="button"
              onClick={onSendTest}
              disabled={sending || !subscribed}
              className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                backgroundColor: colors.brandGold,
                color: colors.brandDark,
              }}
            >
              {sending ? t("common.loading") : `${t("digest.sendButton")} (${frequency === "daily" ? "Daily" : "Weekly"})`}
            </button>
          </div>
        </section>

        {digest ? (
          <section
            className="rounded-2xl border p-6 shadow-sm"
            style={{
              borderColor: colors.border,
              borderLeft: `6px solid ${colors.brandDark}`,
              backgroundColor: colors.bgPrimary,
            }}
          >
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.textSecondary }}>
              Dzisiejszy digest
            </p>
            <p className="mt-1 text-sm" style={{ color: colors.textMuted }}>
              {digest.date}
            </p>
            <p className="mt-4 text-lg leading-relaxed" style={{ color: colors.textPrimary }}>
              {digest.digest}
            </p>
          </section>
        ) : (
          <section
            className="rounded-2xl border p-6 text-sm"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textSecondary }}
          >
            {t("digest.emptyState")}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: colors.textSecondary }}>
            Poprzednie digesty
          </h2>
          {previousDigests.length > 0 ? (
            previousDigests.map((entry) => (
              <article
                key={`${entry.date}-${entry.digest.slice(0, 16)}`}
                className="rounded-xl border p-4"
                style={{ borderColor: colors.borderStrong, backgroundColor: colors.bgPrimary }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.brandDark }}>
                  {entry.date}
                </p>
                <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                  {digestPreview(entry.digest)}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm" style={{ color: colors.textMuted }}>
              Brak poprzednich digestow do wyswietlenia.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
