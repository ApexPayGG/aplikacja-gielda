import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
import { api } from "../services/api";
import { getAlpacaAccount, getAlpacaSettings, getTaxSystems, saveAlpacaSettings, type TaxSystemItem } from "../services/api";

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

  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [mirrorRevenue, setMirrorRevenue] = useState(10);
  const [mirrorLoading, setMirrorLoading] = useState(true);
  const [mirrorSaving, setMirrorSaving] = useState(false);
  const [mirrorNotice, setMirrorNotice] = useState<string | null>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [alpacaApiKey, setAlpacaApiKey] = useState("");
  const [alpacaApiSecret, setAlpacaApiSecret] = useState("");
  const [alpacaMode, setAlpacaMode] = useState<"paper" | "live">("paper");
  const [taxCountry, setTaxCountry] = useState("PL");
  const [taxSystems, setTaxSystems] = useState<TaxSystemItem[]>([]);
  const [alpacaStatus, setAlpacaStatus] = useState<string | null>(null);
  const [alpacaError, setAlpacaError] = useState<string | null>(null);
  const [alpacaSaving, setAlpacaSaving] = useState(false);
  const [alpacaTesting, setAlpacaTesting] = useState(false);
  const [affiliateImpact, setAffiliateImpact] = useState<{
    clicks: number;
    openedAccounts: number;
    supportAmount: number;
    periodDays: number;
  } | null>(null);
  const [affiliateImpactError, setAffiliateImpactError] = useState<string | null>(null);

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

  useEffect(() => {
    const loadAffiliateImpact = async () => {
      setAffiliateImpactError(null);
      try {
        const { data } = await api.get<{
          clicks: number;
          openedAccounts: number;
          supportAmount: number;
          periodDays: number;
        }>("/affiliate/my-impact", { params: { userId, periodDays: 30 } });
        setAffiliateImpact(data);
      } catch {
        setAffiliateImpactError(t("affiliate.impact.loadError", { defaultValue: "Failed to load impact." }));
      }
    };
    void loadAffiliateImpact();
  }, [t, userId]);

  useEffect(() => {
    const loadAlpaca = async () => {
      setAlpacaError(null);
      try {
        const [settings, systems] = await Promise.all([getAlpacaSettings(userId), getTaxSystems()]);
        setAlpacaApiKey(settings.alpacaApiKey || "");
        setAlpacaApiSecret(settings.alpacaApiSecret || "");
        setAlpacaMode(settings.alpacaMode || "paper");
        setTaxCountry(settings.taxCountry || "PL");
        setTaxSystems(systems);
      } catch {
        setAlpacaError(t("alpaca.settingsLoadError", { defaultValue: "Failed to load Alpaca settings." }));
      }
    };
    void loadAlpaca();
  }, [t, userId]);

  useEffect(() => {
    const loadMirror = async () => {
      setMirrorLoading(true);
      setMirrorError(null);
      try {
        const { data } = await api.get<{ enabled: boolean; revenueShare: number }>(
          `/mirror/permission/${encodeURIComponent(userId)}`,
        );
        setMirrorEnabled(Boolean(data.enabled));
        setMirrorRevenue(Math.min(50, Math.max(0, Number(data.revenueShare) || 0)));
      } catch {
        setMirrorError(t("mirror.loadError"));
      } finally {
        setMirrorLoading(false);
      }
    };
    void loadMirror();
  }, [t, userId]);

  async function persistMirror(nextEnabled: boolean, nextRevenue: number): Promise<void> {
    const revenue = Math.min(50, Math.max(0, nextRevenue));
    setMirrorSaving(true);
    setMirrorNotice(null);
    setMirrorError(null);
    try {
      const { data } = await api.post<{ enabled: boolean; revenueShare: number }>(
        `/mirror/enable/${encodeURIComponent(userId)}`,
        { revenueShare: revenue, enabled: nextEnabled },
      );
      setMirrorEnabled(data.enabled);
      setMirrorRevenue(Math.min(50, Math.max(0, data.revenueShare)));
      setMirrorNotice(t("mirror.saved"));
    } catch {
      setMirrorError(t("mirror.actionError"));
    } finally {
      setMirrorSaving(false);
    }
  }

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

  async function saveAlpaca(): Promise<void> {
    setAlpacaSaving(true);
    setAlpacaError(null);
    setAlpacaStatus(null);
    try {
      await saveAlpacaSettings({ userId, alpacaApiKey, alpacaApiSecret, alpacaMode });
      setAlpacaStatus(t("alpaca.settingsSaved", { defaultValue: "Saved" }));
    } catch {
      setAlpacaError(t("alpaca.settingsSaveError", { defaultValue: "Failed to save Alpaca settings." }));
    } finally {
      setAlpacaSaving(false);
    }
  }

  async function testAlpacaConnection(): Promise<void> {
    setAlpacaTesting(true);
    setAlpacaError(null);
    setAlpacaStatus(null);
    try {
      await getAlpacaAccount(userId);
      setAlpacaStatus(t("alpaca.connected", { defaultValue: "Connected" }));
    } catch {
      setAlpacaError(t("alpaca.connectionError", { defaultValue: "Connection error" }));
    } finally {
      setAlpacaTesting(false);
    }
  }

  async function saveTaxResidency(): Promise<void> {
    setAlpacaSaving(true);
    setAlpacaError(null);
    setAlpacaStatus(null);
    try {
      await saveAlpacaSettings({ userId, taxCountry });
      setAlpacaStatus(t("alpaca.settingsSaved", { defaultValue: "Saved" }));
    } catch {
      setAlpacaError(t("alpaca.settingsSaveError", { defaultValue: "Failed to save Alpaca settings." }));
    } finally {
      setAlpacaSaving(false);
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
              <h2 className="text-lg font-semibold text-white">{t("alpaca.settingsTitle", { defaultValue: "Alpaca" })}</h2>
              <p className="text-sm text-slate-400">
                {t("alpaca.settingsSubtitle", {
                  defaultValue: "Connect Alpaca API keys and choose account mode.",
                })}
              </p>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
            <input
              value={alpacaApiKey}
              onChange={(e) => setAlpacaApiKey(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-blue/60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
            <input
              value={alpacaApiSecret}
              onChange={(e) => setAlpacaApiSecret(e.target.value)}
              type="password"
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-blue/60"
            />
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-300">{t("alpaca.mode", { defaultValue: "Mode" })}</span>
            <button
              type="button"
              onClick={() => setAlpacaMode("paper")}
              className={`rounded px-3 py-1 ${alpacaMode === "paper" ? "bg-brand-green/20 text-brand-green" : "bg-slate-800 text-slate-300"}`}
            >
              {t("alpaca.modePaper", { defaultValue: "PAPER" })}
            </button>
            <button
              type="button"
              onClick={() => setAlpacaMode("live")}
              className={`rounded px-3 py-1 ${alpacaMode === "live" ? "bg-brand-blue/20 text-brand-blue" : "bg-slate-800 text-slate-300"}`}
            >
              {t("alpaca.modeLive", { defaultValue: "LIVE" })}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveAlpaca()}
              disabled={alpacaSaving}
              className="rounded-lg border border-brand-blue/60 bg-brand-blue/10 px-4 py-2 text-sm text-brand-blue transition hover:bg-brand-blue/20 disabled:opacity-60"
            >
              {alpacaSaving ? t("common.loading") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => void testAlpacaConnection()}
              disabled={alpacaTesting}
              className="rounded-lg border border-brand-green/60 bg-brand-green/10 px-4 py-2 text-sm text-brand-green transition hover:bg-brand-green/20 disabled:opacity-60"
            >
              {alpacaTesting ? t("common.loading") : t("alpaca.testConnection", { defaultValue: "Test connection" })}
            </button>
          </div>
          {alpacaStatus ? <p className="text-sm text-brand-green">{alpacaStatus}</p> : null}
          {alpacaError ? <p className="text-sm text-brand-red">{alpacaError}</p> : null}
        </section>

        <section className="neo-panel space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Tax Residency</h2>
              <p className="text-sm text-slate-400">{t("tax.selectCountry")}</p>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">{t("tax.selectCountry")}</span>
            <select
              value={taxCountry}
              onChange={(e) => setTaxCountry(String(e.target.value).toUpperCase())}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none transition focus:border-brand-blue/60"
            >
              {taxSystems.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {`${TAX_COUNTRY_FLAGS[entry.code] ?? ""} ${entry.name}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void saveTaxResidency()}
            disabled={alpacaSaving}
            className="rounded-lg border border-brand-blue/60 bg-brand-blue/10 px-4 py-2 text-sm text-brand-blue transition hover:bg-brand-blue/20 disabled:opacity-60"
          >
            {alpacaSaving ? t("common.loading") : t("common.save")}
          </button>
        </section>

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("mirror.settingsTitle")}</h2>
              <p className="text-sm text-slate-400">{t("mirror.settingsSubtitle")}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mirrorEnabled
                  ? "border border-brand-green/60 bg-brand-green/10 text-brand-green"
                  : "border border-slate-700 bg-slate-900/70 text-slate-300"
              }`}
            >
              {mirrorEnabled ? t("mentor.enabled") : t("mentor.disabled")}
            </span>
          </div>

          {mirrorLoading ? (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-300">{t("mirror.toggleLabel")}</p>
                <button
                  type="button"
                  disabled={mirrorSaving}
                  onClick={() => void persistMirror(!mirrorEnabled, mirrorRevenue)}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${
                    mirrorEnabled
                      ? "border-brand-green/70 bg-brand-green/10 text-brand-green"
                      : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-brand-blue/50"
                  }`}
                >
                  {mirrorSaving ? t("mirror.saving") : mirrorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{t("mirror.revenueShare")}</span>
                  <span className="font-mono text-brand-blue">{mirrorRevenue}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={mirrorRevenue}
                  disabled={mirrorSaving}
                  onChange={(e) => setMirrorRevenue(Number(e.target.value))}
                  onPointerUp={(e) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    void persistMirror(mirrorEnabled, v);
                  }}
                  className="w-full accent-brand-blue"
                />
                <p className="text-xs text-slate-500">{t("mirror.revenueShareHint")}</p>
              </div>
            </>
          )}

          {mirrorNotice ? <p className="text-sm text-brand-green">{mirrorNotice}</p> : null}
          {mirrorError ? <p className="text-sm text-brand-red">{mirrorError}</p> : null}
        </section>

        <section className="neo-panel space-y-4 rounded-xl p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t("affiliate.impact.title", { defaultValue: "My impact" })}
            </h2>
            <p className="text-sm text-slate-400">
              {t("affiliate.impact.subtitle", {
                defaultValue: "Your trust supports StockAI development.",
              })}
            </p>
          </div>
          {affiliateImpact ? (
            <div className="grid gap-2 text-sm text-slate-200">
              <p>
                {t("affiliate.impact.clicks", { defaultValue: "Broker clicks (30d): {{count}}", count: affiliateImpact.clicks })}
              </p>
              <p>
                {t("affiliate.impact.accounts", {
                  defaultValue: "Opened accounts (30d): {{count}}",
                  count: affiliateImpact.openedAccounts,
                })}
              </p>
              <p>
                {t("affiliate.impact.support", {
                  defaultValue: "Estimated support (30d): ~{{amount}}",
                  amount: affiliateImpact.supportAmount.toFixed(2),
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t("common.loading")}</p>
          )}
          {affiliateImpactError ? <p className="text-sm text-brand-red">{affiliateImpactError}</p> : null}
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
