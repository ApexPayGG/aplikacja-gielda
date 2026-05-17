import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrokerCTAButton } from "../components/affiliate/BrokerCTAButton";
import { TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { getAlpacaAccount, getAlpacaSettings, getTaxSystems, saveAlpacaSettings, type TaxSystemItem } from "../services/api";
import { colors } from "../styles/designSystem";

type MentorStyle = "supportive" | "strict";
type SettingsSectionId = "profile" | "subscription" | "brokers" | "notifications" | "language";
const DEFAULT_USER_ID = "";
const LANGUAGE_OPTIONS = [
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

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
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [userId] = useState<string>(() => readUserId());
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");
  const [languageNotice, setLanguageNotice] = useState<string | null>(null);
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
  const currentPlan = useMemo<"FREE" | "PRO" | "PRO+">(() => {
    const tier = user?.tier?.toUpperCase() ?? "FREE";
    if (tier.includes("PRO+") || tier.includes("PRO_PLUS")) return "PRO+";
    if (tier.includes("PRO")) return "PRO";
    return "FREE";
  }, [user?.tier]);
  const selectedLanguage = useMemo(
    () => LANGUAGE_OPTIONS.find((opt) => i18n.resolvedLanguage?.startsWith(opt.code))?.code ?? "en",
    [i18n.resolvedLanguage],
  );

  async function onLanguageChange(next: string): Promise<void> {
    await i18n.changeLanguage(next);
    window.localStorage.setItem("stockai.lang", next);
    setLanguageNotice(t("settings.language.saved", { defaultValue: "Language updated." }));
  }

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

  const navigationItems: Array<{ id: SettingsSectionId; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "subscription", label: "Subscription" },
    { id: "brokers", label: "Brokers" },
    { id: "notifications", label: "Notifications" },
    { id: "language", label: "Language" },
  ];
  const cardClass = "rounded-2xl border border-border/80 bg-bgPrimary p-6 shadow-[0_12px_30px_rgba(45,10,107,0.12)]";
  const nestedCardClass = "rounded-xl border border-border bg-bgSecondary p-4";
  const fieldClass =
    "w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-brandCyan";
  const secondaryButtonClass =
    "rounded-xl border border-borderStrong bg-bgPrimary px-4 py-2 text-sm font-medium text-brandDark transition hover:border-brandDark/40 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-8 text-textPrimary">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[230px_1fr]">
        <aside className={`${cardClass} h-fit lg:sticky lg:top-24`}>
          <h1 className="text-xl font-bold text-textPrimary">{t("mentor.settingsTitle", { defaultValue: "Settings" })}</h1>
          <p className="mt-1 text-sm text-textSecondary">
            {t("mentor.settingsSubtitle", { defaultValue: "Manage your StockAI account preferences." })}
          </p>
          <nav className="mt-6 space-y-2">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  document.getElementById(`settings-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-brandDark text-white"
                    : "bg-bgSecondary text-textSecondary hover:bg-bgTertiary hover:text-brandDark"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="settings-profile" className={cardClass}>
            <h2 className="text-lg font-semibold text-textPrimary">Profile</h2>
            <p className="mt-1 text-sm text-textSecondary">Twoje informacje konta i ustawienia mentora.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={nestedCardClass}>
                <p className="text-xs uppercase tracking-wide text-textMuted">Email</p>
                <p className="mt-1 font-medium text-textPrimary">{user?.email ?? "—"}</p>
              </div>
              <div className={nestedCardClass}>
                <p className="text-xs uppercase tracking-wide text-textMuted">User ID</p>
                <p className="mt-1 break-all font-medium text-textPrimary">{userId || "—"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-bgSecondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-textPrimary">{t("mentor.toggleLabel")}</h3>
                  <p className="text-sm text-textSecondary">
                    {t("mentor.currentStatus")}: {statusLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateMentorEnabled(!mentorEnabled)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    mentorEnabled
                      ? "border-positive/60 bg-positive/10 text-positive"
                      : "border-borderStrong bg-bgPrimary text-brandDark hover:border-brandDark/40"
                  }`}
                >
                  {mentorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
                </button>
              </div>

              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold text-textSecondary">{t("mentor.styleLabel")}</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("supportive")}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      mentorStyle === "supportive"
                        ? "border-brandCyan/70 bg-brandCyan/10 text-brandDark"
                        : "border-borderStrong bg-bgPrimary text-textSecondary hover:border-brandDark/40"
                    }`}
                  >
                    {t("mentor.styleSupportive")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("strict")}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      mentorStyle === "strict"
                        ? "border-brandCyan/70 bg-brandCyan/10 text-brandDark"
                        : "border-borderStrong bg-bgPrimary text-textSecondary hover:border-brandDark/40"
                    }`}
                  >
                    {t("mentor.styleStrict")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="settings-subscription" className={cardClass}>
            <h2 className="text-lg font-semibold text-textPrimary">Subscription</h2>
            <p className="mt-1 text-sm text-textSecondary">Zarządzaj planem i odblokuj dodatkowe funkcje platformy.</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-bgSecondary p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-textMuted">Current plan</p>
                <span className="mt-2 inline-flex rounded-full bg-brandDark px-3 py-1 text-xs font-semibold text-white">
                  {currentPlan}
                </span>
              </div>
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                style={{ background: `linear-gradient(130deg, ${colors.brandDark}, ${colors.brandMedium})` }}
              >
                Upgrade plan
              </button>
            </div>
          </section>

          <section id="settings-brokers" className={cardClass}>
            <h2 className="text-lg font-semibold text-textPrimary">Brokers</h2>
            <p className="mt-1 text-sm text-textSecondary">Integracje brokerskie, podatki i mirror trading w jednym miejscu.</p>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-textPrimary">{t("alpaca.settingsTitle", { defaultValue: "Alpaca" })}</h3>
                <p className="text-sm text-textSecondary">
                  {t("alpaca.settingsSubtitle", {
                    defaultValue: "Connect Alpaca API keys and choose account mode.",
                  })}
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-textSecondary">{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
                  <input value={alpacaApiKey} onChange={(e) => setAlpacaApiKey(e.target.value)} className={fieldClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-textSecondary">{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
                  <input
                    value={alpacaApiSecret}
                    onChange={(e) => setAlpacaApiSecret(e.target.value)}
                    type="password"
                    className={fieldClass}
                  />
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-textSecondary">{t("alpaca.mode", { defaultValue: "Mode" })}</span>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("paper")}
                    className={`rounded-lg px-3 py-1 ${
                      alpacaMode === "paper" ? "bg-brandDark text-white" : "bg-bgPrimary text-textSecondary"
                    }`}
                  >
                    {t("alpaca.modePaper", { defaultValue: "PAPER" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("live")}
                    className={`rounded-lg px-3 py-1 ${
                      alpacaMode === "live" ? "bg-brandDark text-white" : "bg-bgPrimary text-textSecondary"
                    }`}
                  >
                    {t("alpaca.modeLive", { defaultValue: "LIVE" })}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void saveAlpaca()} disabled={alpacaSaving} className={secondaryButtonClass}>
                    {alpacaSaving ? t("common.loading") : t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void testAlpacaConnection()}
                    disabled={alpacaTesting}
                    className={secondaryButtonClass}
                  >
                    {alpacaTesting ? t("common.loading") : t("alpaca.testConnection", { defaultValue: "Test connection" })}
                  </button>
                </div>
                {alpacaStatus ? <p className="text-sm text-positive">{alpacaStatus}</p> : null}
                {alpacaError ? <p className="text-sm text-negative">{alpacaError}</p> : null}
              </div>

              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-textPrimary">Tax Residency</h3>
                <p className="text-sm text-textSecondary">{t("tax.selectCountry")}</p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-textSecondary">{t("tax.selectCountry")}</span>
                  <select
                    value={taxCountry}
                    onChange={(e) => setTaxCountry(String(e.target.value).toUpperCase())}
                    className={fieldClass}
                  >
                    {taxSystems.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {`${TAX_COUNTRY_FLAGS[entry.code] ?? ""} ${entry.name}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => void saveTaxResidency()} disabled={alpacaSaving} className={secondaryButtonClass}>
                  {alpacaSaving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className={`${nestedCardClass} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-textPrimary">{t("mirror.settingsTitle")}</h3>
                  <span className="rounded-full bg-brandDark px-3 py-1 text-xs font-semibold text-white">
                    {mirrorEnabled ? t("mentor.enabled") : t("mentor.disabled")}
                  </span>
                </div>
                <p className="text-sm text-textSecondary">{t("mirror.settingsSubtitle")}</p>
                {mirrorLoading ? (
                  <p className="text-sm text-textSecondary">{t("common.loading")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-textSecondary">{t("mirror.toggleLabel")}</p>
                      <button
                        type="button"
                        disabled={mirrorSaving}
                        onClick={() => void persistMirror(!mirrorEnabled, mirrorRevenue)}
                        className={secondaryButtonClass}
                      >
                        {mirrorSaving ? t("mirror.saving") : mirrorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-textSecondary">{t("mirror.revenueShare")}</span>
                        <span className="font-mono text-brandDark">{mirrorRevenue}%</span>
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
                        className="w-full accent-brandDark"
                      />
                      <p className="text-xs text-textMuted">{t("mirror.revenueShareHint")}</p>
                    </div>
                  </>
                )}
                {mirrorNotice ? <p className="text-sm text-positive">{mirrorNotice}</p> : null}
                {mirrorError ? <p className="text-sm text-negative">{mirrorError}</p> : null}
              </div>

              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-textPrimary">
                  {t("affiliate.impact.title", { defaultValue: "My impact" })}
                </h3>
                <p className="text-sm text-textSecondary">
                  {t("affiliate.impact.subtitle", {
                    defaultValue: "Your trust supports StockAI development.",
                  })}
                </p>
                {affiliateImpact ? (
                  <div className="grid gap-2 text-sm text-textPrimary">
                    <p>
                      {t("affiliate.impact.clicks", {
                        defaultValue: "Broker clicks (30d): {{count}}",
                        count: affiliateImpact.clicks,
                      })}
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
                  <p className="text-sm text-textSecondary">{t("common.loading")}</p>
                )}
                {affiliateImpactError ? <p className="text-sm text-negative">{affiliateImpactError}</p> : null}
              </div>
            </div>

            <div className={`${nestedCardClass} mt-4 space-y-4`}>
              <div>
                <h3 className="font-semibold text-textPrimary">
                  {t("etoro.settings.sectionTitle", { defaultValue: "Recommended Brokers" })}
                </h3>
                <p className="text-sm text-textSecondary">
                  {t("etoro.settings.sectionSubtitle", {
                    defaultValue: "Explore trusted brokers integrated with StockAI affiliate tracking.",
                  })}
                </p>
              </div>
              <div className="rounded-xl border border-brandCyan/35 bg-brandCyan/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-bgPrimary px-2 text-xs font-bold text-[#00c853]">
                    eToro
                  </span>
                  <div>
                    <p className="font-semibold text-textPrimary">{t("etoro.settings.cardTitle", { defaultValue: "eToro" })}</p>
                    <p className="text-sm text-textSecondary">
                      {t("etoro.settings.cardDescription", {
                        defaultValue: "Multi-asset broker with a simple account opening flow and stock access.",
                      })}
                    </p>
                  </div>
                </div>
                <BrokerCTAButton
                  sourcePage="settings"
                  brokerSlug="etoro"
                  label={t("etoro.settings.button", { defaultValue: "Learn more & open account" })}
                  size="small"
                  variant="primary"
                  showDisclosure={false}
                  className="mt-4"
                />
              </div>
            </div>
          </section>

          <section id="settings-notifications" className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-textPrimary">Notifications</h2>
                <p className="text-sm text-textSecondary">{t("discord.subtitle")}</p>
              </div>
              <span className="rounded-full bg-brandDark px-3 py-1 text-xs font-semibold text-white">
                {hasActiveWebhook ? t("discord.active") : t("discord.inactive")}
              </span>
            </div>

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="text-textSecondary">{t("discord.webhookLabel")}</span>
              <input
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder={t("discord.webhookPlaceholder")}
                className={fieldClass}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingWebhook || loadingWebhook}
                onClick={() => void saveDiscordWebhook()}
                className={secondaryButtonClass}
              >
                {savingWebhook ? t("common.loading") : t("discord.saveButton")}
              </button>
              <button
                type="button"
                disabled={testingWebhook || loadingWebhook || !hasActiveWebhook}
                onClick={() => void testDiscordWebhook()}
                className={secondaryButtonClass}
              >
                {testingWebhook ? t("common.loading") : t("discord.testButton")}
              </button>
            </div>

            <div className="mt-3 space-y-1">
              {discordNotice ? <p className="text-sm text-positive">{discordNotice}</p> : null}
              {discordError ? <p className="text-sm text-negative">{discordError}</p> : null}
            </div>
          </section>

          <section id="settings-language" className={cardClass}>
            <h2 className="text-lg font-semibold text-textPrimary">Language</h2>
            <p className="mt-1 text-sm text-textSecondary">Wybierz język interfejsu aplikacji.</p>
            <div className="mt-4 max-w-xs">
              <select
                value={selectedLanguage}
                onChange={(e) => void onLanguageChange(e.target.value)}
                className={fieldClass}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.label}
                  </option>
                ))}
              </select>
            </div>
            {languageNotice ? <p className="mt-3 text-sm text-positive">{languageNotice}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
