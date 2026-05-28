import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BrokerCTAButton } from "../components/affiliate/BrokerCTAButton";
import { TAX_COUNTRY_FLAGS } from "../constants/taxCountries";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  getAlpacaAccount,
  getAlpacaSettings,
  getNotificationPreferencesApi,
  getTaxSystems,
  saveAlpacaSettings,
  saveNotificationPreferencesApi,
  testNotificationPreferencesApi,
  type NotificationPreferences,
  type TaxSystemItem,
} from "../services/api";
import {
  TERMINAL_APP_BG,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_CHECKBOX_ROW,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_FORM_GROUP,
  TERMINAL_FORM_LABEL,
  TERMINAL_HELP_TEXT,
  TERMINAL_INFO_BANNER,
  TERMINAL_INPUT,
  TERMINAL_LINK_ACCENT,
  TERMINAL_PAGE_SHELL,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SETTINGS_CARD,
  TERMINAL_SETTINGS_NAV_ACTIVE,
  TERMINAL_SETTINGS_NAV_IDLE,
  TERMINAL_SETTINGS_NAV_ITEM,
  TERMINAL_SETTINGS_ROW,
  TERMINAL_TEXT_MUTED,
} from "../components/terminal/terminalStyles";

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

function normalizeSignalScore(score: number): number {
  if (!Number.isFinite(score)) return 70;
  return Math.max(50, Math.min(100, Math.round(score)));
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
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    discordWebhook: null,
    telegramChatId: null,
    notifySignals: true,
    notifyDividends: true,
    minSignalScore: 70,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [notificationsNotice, setNotificationsNotice] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

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
    const loadNotificationPreferences = async () => {
      setLoadingNotifications(true);
      setNotificationsError(null);
      try {
        const data = await getNotificationPreferencesApi(userId);
        setNotifications({
          discordWebhook: (data.discordWebhook ?? "").trim() || null,
          telegramChatId: (data.telegramChatId ?? "").trim() || null,
          notifySignals: Boolean(data.notifySignals),
          notifyDividends: Boolean(data.notifyDividends),
          minSignalScore: normalizeSignalScore(Number(data.minSignalScore)),
        });
      } catch {
        setNotificationsError(t("settingsPageNotifications.loadFailed", { defaultValue: "Failed to load notification settings." }));
      } finally {
        setLoadingNotifications(false);
      }
    };
    void loadNotificationPreferences();
  }, [userId, t]);

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

  async function saveNotificationPreferences(): Promise<void> {
    setSavingNotifications(true);
    setNotificationsNotice(null);
    setNotificationsError(null);
    try {
      const payload: NotificationPreferences = {
        discordWebhook: (notifications.discordWebhook ?? "").trim() || null,
        telegramChatId: (notifications.telegramChatId ?? "").trim() || null,
        notifySignals: Boolean(notifications.notifySignals),
        notifyDividends: Boolean(notifications.notifyDividends),
        minSignalScore: normalizeSignalScore(notifications.minSignalScore),
      };
      const data = await saveNotificationPreferencesApi(userId, payload);
      setNotifications({
        discordWebhook: (data.discordWebhook ?? "").trim() || null,
        telegramChatId: (data.telegramChatId ?? "").trim() || null,
        notifySignals: Boolean(data.notifySignals),
        notifyDividends: Boolean(data.notifyDividends),
        minSignalScore: normalizeSignalScore(data.minSignalScore),
      });
      setNotificationsNotice(t("settingsPageNotifications.saved", { defaultValue: "Notification preferences saved." }));
    } catch {
      setNotificationsError(t("settingsPageNotifications.saveFailed", { defaultValue: "Failed to save notification preferences." }));
    } finally {
      setSavingNotifications(false);
    }
  }

  async function testNotificationDelivery(): Promise<void> {
    setTestingNotifications(true);
    setNotificationsNotice(null);
    setNotificationsError(null);
    try {
      const data = await testNotificationPreferencesApi(userId);
      if (data.discordSent || data.telegramSent) {
        const channels = [data.discordSent ? "Discord" : null, data.telegramSent ? "Telegram" : null]
          .filter(Boolean)
          .join(" + ");
        setNotificationsNotice(
          t("settingsPageNotifications.testSent", {
            channels,
            defaultValue: "Test sent to: {{channels}}.",
          }),
        );
        return;
      }
      setNotificationsError(
        t("settingsPageNotifications.testNoChannels", {
          defaultValue: "No active channels or the test send failed.",
        }),
      );
    } catch {
      setNotificationsError(t("settingsPageNotifications.testSendFailed", { defaultValue: "Failed to send a test notification." }));
    } finally {
      setTestingNotifications(false);
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
  const cardClass = TERMINAL_SETTINGS_CARD;
  const nestedCardClass = TERMINAL_SETTINGS_ROW;
  const fieldClass = TERMINAL_INPUT;
  const secondaryButtonClass = TERMINAL_BUTTON_SECONDARY;

  return (
    <div className={`${TERMINAL_APP_BG} px-4 py-8`}>
      <div className={`${TERMINAL_PAGE_SHELL} grid max-w-7xl gap-6 lg:grid-cols-[230px_1fr]`}>
        <aside className={`${cardClass} h-fit lg:sticky lg:top-24`}>
          <h1 className={TERMINAL_PAGE_TITLE}>{t("mentor.settingsTitle", { defaultValue: "Settings" })}</h1>
          <p className={`mt-1 ${TERMINAL_TEXT_MUTED}`}>
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
                className={`${TERMINAL_SETTINGS_NAV_ITEM} ${
                  activeSection === item.id ? TERMINAL_SETTINGS_NAV_ACTIVE : TERMINAL_SETTINGS_NAV_IDLE
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className={`mt-6 ${TERMINAL_SETTINGS_ROW} p-3`}>
            <p className={TERMINAL_FORM_LABEL}>Product</p>
            <Link to="/changelog" className={`mt-2 inline-flex text-sm ${TERMINAL_LINK_ACCENT}`}>
              {t("settingsPageSections.changelogLink", { defaultValue: "What's new (Changelog)" })}
            </Link>
            <Link to="/help" className={`mt-1 inline-flex text-sm ${TERMINAL_LINK_ACCENT}`}>
              {t("settingsPageSections.helpCenterLink", { defaultValue: "Help center" })}
            </Link>
          </div>
        </aside>

        <div className="space-y-6">
          <section id="settings-profile" className={cardClass}>
            <h2 className="text-lg font-semibold text-terminal-text">Profile</h2>
            <p className={`mt-1 ${TERMINAL_TEXT_MUTED}`}>
              {t("settingsPageSections.profileSubtitle", { defaultValue: "Your account details and mentor settings." })}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={nestedCardClass}>
                <p className={TERMINAL_FORM_LABEL}>{t("auth.email")}</p>
                <p className="mt-1 font-medium text-terminal-text">{user?.email ?? "—"}</p>
              </div>
              <div className={nestedCardClass}>
                <p className={TERMINAL_FORM_LABEL}>User ID</p>
                <p className="mt-1 break-all font-medium text-terminal-text">{userId || "—"}</p>
              </div>
            </div>

            <div className={`mt-4 ${TERMINAL_SETTINGS_ROW}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-terminal-text">{t("mentor.toggleLabel")}</h3>
                  <p className={TERMINAL_TEXT_MUTED}>
                    {t("mentor.currentStatus")}: {statusLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateMentorEnabled(!mentorEnabled)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    mentorEnabled
                      ? "border-terminal-positive/50 bg-terminal-positive/10 text-terminal-positive"
                      : `${TERMINAL_BUTTON_SECONDARY}`
                  }`}
                >
                  {mentorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
                </button>
              </div>

              <div className="mt-4">
                <h4 className={`mb-2 text-sm font-semibold ${TERMINAL_TEXT_MUTED}`}>{t("mentor.styleLabel")}</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("supportive")}
                    className={
                      mentorStyle === "supportive" ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP
                    }
                  >
                    {t("mentor.styleSupportive")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("strict")}
                    className={mentorStyle === "strict" ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                  >
                    {t("mentor.styleStrict")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="settings-subscription" className={cardClass}>
            <h2 className="text-lg font-semibold text-terminal-text">Subscription</h2>
            <p className={`mt-1 ${TERMINAL_TEXT_MUTED}`}>
              {t("settingsPageSections.subscriptionSubtitle", {
                defaultValue: "Manage your plan and unlock more platform capabilities.",
              })}
            </p>
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-4 ${TERMINAL_SETTINGS_ROW}`}>
              <div>
                <p className={TERMINAL_FORM_LABEL}>Current plan</p>
                <span className="mt-2 inline-flex rounded-full border border-terminal-cyan/40 bg-terminal-cyan/15 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                  {currentPlan}
                </span>
              </div>
              {currentPlan === "FREE" ? (
                <Link to="/pricing" className={TERMINAL_BUTTON_PRIMARY}>
                  Upgrade plan
                </Link>
              ) : (
                <p className="text-sm text-terminal-textSecondary">
                  {t("settingsPageSections.planActive", {
                    plan: currentPlan,
                    defaultValue: "Your {{plan}} plan is active.",
                  })}
                </p>
              )}
            </div>
            <div className={`mt-4 ${TERMINAL_INFO_BANNER}`}>
              <p className="text-sm text-terminal-text">
                {t("settingsPageSections.apiProBanner", {
                  plan: "Pro+",
                  defaultValue: "REST API is included on the {{plan}} plan.",
                })}
              </p>
              <Link to="/api-docs" className={`mt-2 inline-flex text-sm ${TERMINAL_LINK_ACCENT}`}>
                Zobacz API Documentation
              </Link>
            </div>
          </section>

          <section id="settings-brokers" className={cardClass}>
            <h2 className="text-lg font-semibold text-terminal-text">Brokers</h2>
            <p className="mt-1 text-terminal-textMuted text-sm">Integracje brokerskie, podatki i mirror trading w jednym miejscu.</p>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-terminal-text">{t("alpaca.settingsTitle", { defaultValue: "Alpaca" })}</h3>
                <p className="text-terminal-textMuted text-sm">
                  {t("alpaca.settingsSubtitle", {
                    defaultValue: "Connect Alpaca API keys and choose account mode.",
                  })}
                </p>
                <label className={TERMINAL_FORM_GROUP}>
                  <span className={TERMINAL_FORM_LABEL}>{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
                  <input value={alpacaApiKey} onChange={(e) => setAlpacaApiKey(e.target.value)} className={fieldClass} />
                </label>
                <label className={TERMINAL_FORM_GROUP}>
                  <span className={TERMINAL_FORM_LABEL}>{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
                  <input
                    value={alpacaApiSecret}
                    onChange={(e) => setAlpacaApiSecret(e.target.value)}
                    type="password"
                    className={fieldClass}
                  />
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-terminal-textMuted">{t("alpaca.mode", { defaultValue: "Mode" })}</span>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("paper")}
                    className={alpacaMode === "paper" ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
                  >
                    {t("alpaca.modePaper", { defaultValue: "PAPER" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("live")}
                    className={alpacaMode === "live" ? TERMINAL_FILTER_CHIP_ACTIVE : TERMINAL_FILTER_CHIP}
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
                {alpacaStatus ? <p className="text-sm text-terminal-positive">{alpacaStatus}</p> : null}
                {alpacaError ? <p className="text-sm text-terminal-negative">{alpacaError}</p> : null}
              </div>

              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-terminal-text">Tax Residency</h3>
                <p className="text-terminal-textMuted text-sm">{t("tax.selectCountry")}</p>
                <label className={TERMINAL_FORM_GROUP}>
                  <span className={TERMINAL_FORM_LABEL}>{t("tax.selectCountry")}</span>
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
                  <h3 className="font-semibold text-terminal-text">{t("mirror.settingsTitle")}</h3>
                  <span className="rounded-full border border-terminal-cyan/40 bg-terminal-cyan/15 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                    {mirrorEnabled ? t("mentor.enabled") : t("mentor.disabled")}
                  </span>
                </div>
                <p className="text-terminal-textMuted text-sm">{t("mirror.settingsSubtitle")}</p>
                {mirrorLoading ? (
                  <p className="text-terminal-textMuted text-sm">{t("common.loading")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-terminal-textMuted text-sm">{t("mirror.toggleLabel")}</p>
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
                        <span className="text-terminal-textMuted">{t("mirror.revenueShare")}</span>
                        <span className="font-mono text-terminal-cyan">{mirrorRevenue}%</span>
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
                        className="w-full accent-terminal-cyan"
                      />
                      <p className={TERMINAL_HELP_TEXT}>{t("mirror.revenueShareHint")}</p>
                    </div>
                  </>
                )}
                {mirrorNotice ? <p className="text-sm text-terminal-positive">{mirrorNotice}</p> : null}
                {mirrorError ? <p className="text-sm text-terminal-negative">{mirrorError}</p> : null}
              </div>

              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-terminal-text">
                  {t("affiliate.impact.title", { defaultValue: "My impact" })}
                </h3>
                <p className="text-terminal-textMuted text-sm">
                  {t("affiliate.impact.subtitle", {
                    defaultValue: "Your trust supports StockAI development.",
                  })}
                </p>
                {affiliateImpact ? (
                  <div className="grid gap-2 text-sm text-terminal-text">
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
                  <p className="text-terminal-textMuted text-sm">{t("common.loading")}</p>
                )}
                {affiliateImpactError ? <p className="text-sm text-terminal-negative">{affiliateImpactError}</p> : null}
              </div>
            </div>

            <div className={`${nestedCardClass} mt-4 space-y-4`}>
              <div>
                <h3 className="font-semibold text-terminal-text">
                  {t("etoro.settings.sectionTitle", { defaultValue: "Recommended Brokers" })}
                </h3>
                <p className="text-terminal-textMuted text-sm">
                  {t("etoro.settings.sectionSubtitle", {
                    defaultValue: "Explore trusted brokers integrated with StockAI affiliate tracking.",
                  })}
                </p>
              </div>
              <div className={TERMINAL_INFO_BANNER}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-terminal-borderMuted bg-terminal-panelSecondary px-2 text-xs font-bold text-terminal-positive">
                    eToro
                  </span>
                  <div>
                    <p className="font-semibold text-terminal-text">{t("etoro.settings.cardTitle", { defaultValue: "eToro" })}</p>
                    <p className="text-terminal-textMuted text-sm">
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
                <h2 className="text-lg font-semibold text-terminal-text">
                  {t("settingsPageSections.notificationsTitle", { defaultValue: "Notifications" })}
                </h2>
                <p className="text-terminal-textMuted text-sm">
                  {t("settingsPageSections.notificationsSubtitle", {
                    defaultValue: "Configure Discord/Telegram channels and signal delivery thresholds.",
                  })}
                </p>
              </div>
              <span className="rounded-full border border-terminal-cyan/40 bg-terminal-cyan/15 px-3 py-1 text-xs font-semibold text-terminal-cyan">
                {notifications.discordWebhook || notifications.telegramChatId
                  ? t("settingsPageSections.notificationsBadgeActive", { defaultValue: "Active" })
                  : t("settingsPageSections.notificationsBadgeInactive", { defaultValue: "Inactive" })}
              </span>
            </div>

            <label className={`mt-4 ${TERMINAL_FORM_GROUP}`}>
              <span className={TERMINAL_FORM_LABEL}>Discord webhook</span>
              <input
                value={notifications.discordWebhook ?? ""}
                onChange={(e) =>
                  setNotifications((prev) => ({ ...prev, discordWebhook: e.target.value.trim() || null }))
                }
                placeholder="https://discord.com/api/webhooks/..."
                className={fieldClass}
              />
            </label>

            <label className={`mt-4 ${TERMINAL_FORM_GROUP}`}>
              <span className={TERMINAL_FORM_LABEL}>Telegram chat ID</span>
              <input
                value={notifications.telegramChatId ?? ""}
                onChange={(e) =>
                  setNotifications((prev) => ({ ...prev, telegramChatId: e.target.value.trim() || null }))
                }
                placeholder={t("settingsPageSections.telegramPlaceholder", { defaultValue: "e.g. 123456789" })}
                className={fieldClass}
              />
            </label>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className={TERMINAL_CHECKBOX_ROW}>
                <span className="text-terminal-textMuted">
                  {t("settingsPageSections.signalsToggle", { defaultValue: "Signals" })}
                </span>
                <input
                  type="checkbox"
                  checked={notifications.notifySignals}
                  onChange={(e) => setNotifications((prev) => ({ ...prev, notifySignals: e.target.checked }))}
                  className="h-4 w-4 accent-terminal-cyan"
                />
              </label>
              <label className={TERMINAL_CHECKBOX_ROW}>
                <span className="text-terminal-textMuted">
                  {t("settingsPageSections.dividendsToggle", { defaultValue: "Dividends" })}
                </span>
                <input
                  type="checkbox"
                  checked={notifications.notifyDividends}
                  onChange={(e) => setNotifications((prev) => ({ ...prev, notifyDividends: e.target.checked }))}
                  className="h-4 w-4 accent-terminal-cyan"
                />
              </label>
            </div>

            <div className={`mt-4 space-y-2 ${TERMINAL_SETTINGS_ROW} px-3 py-3`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-terminal-textMuted">
                  {t("settingsPageSections.minSignalScore", { defaultValue: "Minimum signal score" })}
                </span>
                <span className="font-mono text-terminal-cyan">{normalizeSignalScore(notifications.minSignalScore)}</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={normalizeSignalScore(notifications.minSignalScore)}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    minSignalScore: normalizeSignalScore(Number(e.target.value)),
                  }))
                }
                className="w-full accent-terminal-cyan"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingNotifications || loadingNotifications}
                onClick={() => void saveNotificationPreferences()}
                className={secondaryButtonClass}
              >
                {savingNotifications ? t("common.loading") : t("common.save")}
              </button>
              <button
                type="button"
                disabled={testingNotifications || loadingNotifications}
                onClick={() => void testNotificationDelivery()}
                className={secondaryButtonClass}
              >
                {testingNotifications ? t("common.loading") : t("settingsPageSections.testNotification", { defaultValue: "Send test notification" })}
              </button>
            </div>

            <div className="mt-3 space-y-1">
              {notificationsNotice ? <p className="text-sm text-terminal-positive">{notificationsNotice}</p> : null}
              {notificationsError ? <p className="text-sm text-terminal-negative">{notificationsError}</p> : null}
            </div>
          </section>

          <section id="settings-language" className={cardClass}>
            <h2 className="text-lg font-semibold text-terminal-text">Language</h2>
            <p className="mt-1 text-terminal-textMuted text-sm">
              {t("settingsPageSections.languageSubtitle", {
                defaultValue: "Choose the app interface language.",
              })}
            </p>
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
            {languageNotice ? <p className="mt-3 text-sm text-terminal-positive">{languageNotice}</p> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
