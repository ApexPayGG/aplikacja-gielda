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
        setNotificationsError("Nie udało się pobrać ustawień powiadomień.");
      } finally {
        setLoadingNotifications(false);
      }
    };
    void loadNotificationPreferences();
  }, [userId]);

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
      setNotificationsNotice("Preferencje powiadomień zapisane.");
    } catch {
      setNotificationsError("Nie udało się zapisać preferencji powiadomień.");
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
        setNotificationsNotice(`Wysłano test na: ${channels}.`);
        return;
      }
      setNotificationsError("Brak aktywnych kanałów lub nie udało się wysłać testu.");
    } catch {
      setNotificationsError("Nie udało się wysłać testowego powiadomienia.");
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
  const cardClass = "rounded-2xl border border-white/10/80 bg-bgPrimary p-6 shadow-[0_12px_30px_rgba(45,10,107,0.12)]";
  const nestedCardClass = "rounded-xl glass-panel border border-white/10 bg-white/5 p-4";
  const fieldClass =
    "w-full rounded-xl border border-bgTertiary bg-bgPrimary px-3 py-2 text-sm text-white outline-none transition focus:border-brandCyan";
  const secondaryButtonClass =
    "rounded-xl border border-white/20 bg-bgPrimary px-4 py-2 text-sm font-medium text-white transition hover:border-brandDark/40 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-bgSecondary px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[230px_1fr]">
        <aside className={`${cardClass} h-fit lg:sticky lg:top-24`}>
          <h1 className="text-xl font-bold text-white">{t("mentor.settingsTitle", { defaultValue: "Settings" })}</h1>
          <p className="mt-1 glass-muted text-sm">
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
                    : "bg-bgSecondary glass-muted hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 rounded-xl glass-panel border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-white/50">Product</p>
            <Link to="/changelog" className="mt-2 inline-flex text-sm font-semibold text-white transition hover:text-brandMedium">
              Co nowego (Changelog)
            </Link>
            <Link to="/help" className="mt-1 inline-flex text-sm font-semibold text-white transition hover:text-brandMedium">
              Centrum pomocy
            </Link>
          </div>
        </aside>

        <div className="space-y-6">
          <section id="settings-profile" className={cardClass}>
            <h2 className="text-lg font-semibold text-white">Profile</h2>
            <p className="mt-1 glass-muted text-sm">Twoje informacje konta i ustawienia mentora.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={nestedCardClass}>
                <p className="text-xs uppercase tracking-wide text-white/50">Email</p>
                <p className="mt-1 font-medium text-white">{user?.email ?? "—"}</p>
              </div>
              <div className={nestedCardClass}>
                <p className="text-xs uppercase tracking-wide text-white/50">User ID</p>
                <p className="mt-1 break-all font-medium text-white">{userId || "—"}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl glass-panel border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{t("mentor.toggleLabel")}</h3>
                  <p className="glass-muted text-sm">
                    {t("mentor.currentStatus")}: {statusLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateMentorEnabled(!mentorEnabled)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    mentorEnabled
                      ? "border-positive/60 bg-positive/10 text-positive"
                      : "border-white/20 bg-bgPrimary text-white hover:border-brandDark/40"
                  }`}
                >
                  {mentorEnabled ? t("mentor.disableAction") : t("mentor.enableAction")}
                </button>
              </div>

              <div className="mt-4">
                <h4 className="mb-2 text-sm font-semibold glass-muted">{t("mentor.styleLabel")}</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("supportive")}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      mentorStyle === "supportive"
                        ? "border-brandCyan/70 bg-brandCyan/10 text-white"
                        : "border-white/20 bg-bgPrimary glass-muted hover:border-brandDark/40"
                    }`}
                  >
                    {t("mentor.styleSupportive")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMentorStyle("strict")}
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      mentorStyle === "strict"
                        ? "border-brandCyan/70 bg-brandCyan/10 text-white"
                        : "border-white/20 bg-bgPrimary glass-muted hover:border-brandDark/40"
                    }`}
                  >
                    {t("mentor.styleStrict")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section id="settings-subscription" className={cardClass}>
            <h2 className="text-lg font-semibold text-white">Subscription</h2>
            <p className="mt-1 glass-muted text-sm">Zarządzaj planem i odblokuj dodatkowe funkcje platformy.</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl glass-panel border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/50">Current plan</p>
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
            <div className="mt-4 rounded-xl border border-brandCyan/40 bg-brandCyan/10 p-4">
              <p className="text-sm text-white">
                API REST to funkcja planu <span className="font-semibold text-white">Pro+</span>.
              </p>
              <Link to="/api-docs" className="mt-2 inline-flex text-sm font-semibold text-white transition hover:text-brandMedium">
                Zobacz API Documentation
              </Link>
            </div>
          </section>

          <section id="settings-brokers" className={cardClass}>
            <h2 className="text-lg font-semibold text-white">Brokers</h2>
            <p className="mt-1 glass-muted text-sm">Integracje brokerskie, podatki i mirror trading w jednym miejscu.</p>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-white">{t("alpaca.settingsTitle", { defaultValue: "Alpaca" })}</h3>
                <p className="glass-muted text-sm">
                  {t("alpaca.settingsSubtitle", {
                    defaultValue: "Connect Alpaca API keys and choose account mode.",
                  })}
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="glass-muted">{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
                  <input value={alpacaApiKey} onChange={(e) => setAlpacaApiKey(e.target.value)} className={fieldClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="glass-muted">{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
                  <input
                    value={alpacaApiSecret}
                    onChange={(e) => setAlpacaApiSecret(e.target.value)}
                    type="password"
                    className={fieldClass}
                  />
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span className="glass-muted">{t("alpaca.mode", { defaultValue: "Mode" })}</span>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("paper")}
                    className={`rounded-lg px-3 py-1 ${
                      alpacaMode === "paper" ? "bg-brandDark text-white" : "bg-bgPrimary glass-muted"
                    }`}
                  >
                    {t("alpaca.modePaper", { defaultValue: "PAPER" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlpacaMode("live")}
                    className={`rounded-lg px-3 py-1 ${
                      alpacaMode === "live" ? "bg-brandDark text-white" : "bg-bgPrimary glass-muted"
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
                <h3 className="font-semibold text-white">Tax Residency</h3>
                <p className="glass-muted text-sm">{t("tax.selectCountry")}</p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="glass-muted">{t("tax.selectCountry")}</span>
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
                  <h3 className="font-semibold text-white">{t("mirror.settingsTitle")}</h3>
                  <span className="rounded-full bg-brandDark px-3 py-1 text-xs font-semibold text-white">
                    {mirrorEnabled ? t("mentor.enabled") : t("mentor.disabled")}
                  </span>
                </div>
                <p className="glass-muted text-sm">{t("mirror.settingsSubtitle")}</p>
                {mirrorLoading ? (
                  <p className="glass-muted text-sm">{t("common.loading")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="glass-muted text-sm">{t("mirror.toggleLabel")}</p>
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
                        <span className="glass-muted">{t("mirror.revenueShare")}</span>
                        <span className="font-mono text-white">{mirrorRevenue}%</span>
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
                      <p className="text-xs text-white/50">{t("mirror.revenueShareHint")}</p>
                    </div>
                  </>
                )}
                {mirrorNotice ? <p className="text-sm text-positive">{mirrorNotice}</p> : null}
                {mirrorError ? <p className="text-sm text-negative">{mirrorError}</p> : null}
              </div>

              <div className={`${nestedCardClass} space-y-3`}>
                <h3 className="font-semibold text-white">
                  {t("affiliate.impact.title", { defaultValue: "My impact" })}
                </h3>
                <p className="glass-muted text-sm">
                  {t("affiliate.impact.subtitle", {
                    defaultValue: "Your trust supports StockAI development.",
                  })}
                </p>
                {affiliateImpact ? (
                  <div className="grid gap-2 text-sm text-white">
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
                  <p className="glass-muted text-sm">{t("common.loading")}</p>
                )}
                {affiliateImpactError ? <p className="text-sm text-negative">{affiliateImpactError}</p> : null}
              </div>
            </div>

            <div className={`${nestedCardClass} mt-4 space-y-4`}>
              <div>
                <h3 className="font-semibold text-white">
                  {t("etoro.settings.sectionTitle", { defaultValue: "Recommended Brokers" })}
                </h3>
                <p className="glass-muted text-sm">
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
                    <p className="font-semibold text-white">{t("etoro.settings.cardTitle", { defaultValue: "eToro" })}</p>
                    <p className="glass-muted text-sm">
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
                <h2 className="text-lg font-semibold text-white">Powiadomienia</h2>
                <p className="glass-muted text-sm">
                  Skonfiguruj kanały Discord/Telegram i progi wysyłki sygnałów.
                </p>
              </div>
              <span className="rounded-full bg-brandDark px-3 py-1 text-xs font-semibold text-white">
                {notifications.discordWebhook || notifications.telegramChatId ? "Aktywne" : "Nieaktywne"}
              </span>
            </div>

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="glass-muted">Discord webhook</span>
              <input
                value={notifications.discordWebhook ?? ""}
                onChange={(e) =>
                  setNotifications((prev) => ({ ...prev, discordWebhook: e.target.value.trim() || null }))
                }
                placeholder="https://discord.com/api/webhooks/..."
                className={fieldClass}
              />
            </label>

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="glass-muted">Telegram chat ID</span>
              <input
                value={notifications.telegramChatId ?? ""}
                onChange={(e) =>
                  setNotifications((prev) => ({ ...prev, telegramChatId: e.target.value.trim() || null }))
                }
                placeholder="np. 123456789"
                className={fieldClass}
              />
            </label>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="glass-muted">Sygnały</span>
                <input
                  type="checkbox"
                  checked={notifications.notifySignals}
                  onChange={(e) => setNotifications((prev) => ({ ...prev, notifySignals: e.target.checked }))}
                  className="h-4 w-4 accent-brandDark"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="glass-muted">Dywidendy</span>
                <input
                  type="checkbox"
                  checked={notifications.notifyDividends}
                  onChange={(e) => setNotifications((prev) => ({ ...prev, notifyDividends: e.target.checked }))}
                  className="h-4 w-4 accent-brandDark"
                />
              </label>
            </div>

            <div className="mt-4 space-y-2 rounded-xl glass-panel border border-white/10 bg-white/5 px-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="glass-muted">Minimalny score sygnału</span>
                <span className="font-mono text-white">{normalizeSignalScore(notifications.minSignalScore)}</span>
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
                className="w-full accent-brandDark"
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
                {testingNotifications ? t("common.loading") : "Testuj powiadomienie"}
              </button>
            </div>

            <div className="mt-3 space-y-1">
              {notificationsNotice ? <p className="text-sm text-positive">{notificationsNotice}</p> : null}
              {notificationsError ? <p className="text-sm text-negative">{notificationsError}</p> : null}
            </div>
          </section>

          <section id="settings-language" className={cardClass}>
            <h2 className="text-lg font-semibold text-white">Language</h2>
            <p className="mt-1 glass-muted text-sm">Wybierz język interfejsu aplikacji.</p>
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
