import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../services/api";

type MentorStyle = "supportive" | "strict";
const DEFAULT_USER_ID = "demo-user";

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function readStoredStyle(): MentorStyle {
  if (typeof window === "undefined") return "supportive";
  return window.localStorage.getItem("mentorStyle") === "strict" ? "strict" : "supportive";
}

function readUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER_ID;
  const fromStorage = window.localStorage.getItem("userId")?.trim();
  return fromStorage || DEFAULT_USER_ID;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [userId] = useState<string>(() => readUserId());
  const [mentorEnabled, setMentorEnabled] = useState<boolean>(() =>
    readStoredBoolean("mentorModeEnabled", false),
  );
  const [mentorStyle, setMentorStyle] = useState<MentorStyle>(() => readStoredStyle());
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [hasActiveWebhook, setHasActiveWebhook] = useState(false);
  const [loadingWebhook, setLoadingWebhook] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [discordNotice, setDiscordNotice] = useState<string | null>(null);
  const [discordError, setDiscordError] = useState<string | null>(null);

  const statusLabel = useMemo(
    () => (mentorEnabled ? t("mentor.enabled") : t("mentor.disabled")),
    [mentorEnabled, t],
  );

  function updateMentorEnabled(value: boolean): void {
    setMentorEnabled(value);
    window.localStorage.setItem("mentorModeEnabled", String(value));
  }

  function updateMentorStyle(value: MentorStyle): void {
    setMentorStyle(value);
    window.localStorage.setItem("mentorStyle", value);
  }

  useEffect(() => {
    const loadWebhook = async () => {
      setLoadingWebhook(true);
      setDiscordError(null);
      try {
        const { data } = await api.get<{ webhookUrl: string | null }>(
          `/discord/webhook/${encodeURIComponent(userId)}`,
        );
        const value = (data.webhookUrl ?? "").trim();
        setDiscordWebhookUrl(value);
        setHasActiveWebhook(Boolean(value));
      } catch {
        setDiscordError(t("discord.loadError"));
      } finally {
        setLoadingWebhook(false);
      }
    };
    void loadWebhook();
  }, [t, userId]);

  async function saveDiscordWebhook(): Promise<void> {
    const nextWebhook = discordWebhookUrl.trim();
    if (!nextWebhook) {
      setDiscordError(t("discord.saveError"));
      return;
    }
    setSavingWebhook(true);
    setDiscordNotice(null);
    setDiscordError(null);
    try {
      const { data } = await api.post<{ saved: boolean }>("/discord/webhook/save", {
        userId,
        webhookUrl: nextWebhook,
      });
      if (data.saved) {
        setHasActiveWebhook(true);
        setDiscordNotice(t("discord.saveSuccess"));
        return;
      }
      setDiscordError(t("discord.saveError"));
    } catch {
      setDiscordError(t("discord.saveError"));
    } finally {
      setSavingWebhook(false);
    }
  }

  async function testDiscordWebhook(): Promise<void> {
    setTestingWebhook(true);
    setDiscordNotice(null);
    setDiscordError(null);
    try {
      const { data } = await api.post<{ sent: boolean }>(
        `/discord/webhook/test/${encodeURIComponent(userId)}`,
      );
      if (data.sent) {
        setDiscordNotice(t("discord.testSuccess"));
      } else {
        setDiscordError(t("discord.testError"));
      }
    } catch {
      setDiscordError(t("discord.testError"));
    } finally {
      setTestingWebhook(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="mb-2 text-3xl font-bold text-white">{t("mentor.settingsTitle")}</h1>
        <p className="mb-6 text-sm text-slate-400">{t("mentor.settingsSubtitle")}</p>

        <section className="neo-panel space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("discord.title")}</h2>
              <p className="text-sm text-slate-400">{t("discord.subtitle")}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                hasActiveWebhook
                  ? "border border-brand-green/60 bg-brand-green/10 text-brand-green"
                  : "border border-slate-700 bg-slate-900/70 text-slate-300"
              }`}
            >
              {hasActiveWebhook ? t("discord.active") : t("discord.inactive")}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t("discord.webhookLabel")}</span>
            <input
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              placeholder={t("discord.webhookPlaceholder")}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-blue/60"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={savingWebhook || loadingWebhook}
              onClick={() => void saveDiscordWebhook()}
              className="rounded-lg border border-brand-blue/60 bg-brand-blue/10 px-4 py-2 text-sm text-brand-blue transition hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingWebhook ? t("common.loading") : t("discord.saveButton")}
            </button>
            <button
              type="button"
              disabled={testingWebhook || loadingWebhook || !hasActiveWebhook}
              onClick={() => void testDiscordWebhook()}
              className="rounded-lg border border-brand-green/60 bg-brand-green/10 px-4 py-2 text-sm text-brand-green transition hover:bg-brand-green/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testingWebhook ? t("common.loading") : t("discord.testButton")}
            </button>
          </div>

          {discordNotice ? <p className="text-sm text-brand-green">{discordNotice}</p> : null}
          {discordError ? <p className="text-sm text-brand-red">{discordError}</p> : null}
        </section>

        <section className="neo-panel space-y-4 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("mentor.toggleLabel")}</h2>
              <p className="text-sm text-slate-400">
                {t("mentor.currentStatus")}: {statusLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateMentorEnabled(!mentorEnabled)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                mentorEnabled
                  ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
              }`}
            >
              {mentorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-green">
              {t("mentor.styleLabel")}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateMentorStyle("supportive")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  mentorStyle === "supportive"
                    ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
                }`}
              >
                {t("mentor.styleSupportive")}
              </button>
              <button
                type="button"
                onClick={() => updateMentorStyle("strict")}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  mentorStyle === "strict"
                    ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                    : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
                }`}
              >
                {t("mentor.styleStrict")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
