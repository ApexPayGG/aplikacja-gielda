import {
  BoltIcon,
  ChartBarSquareIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FeedbackToastStack, type FeedbackToast } from "../components/FeedbackToastStack";
import {
  GLASS_BTN_PRIMARY,
  GLASS_BTN_SECONDARY,
  GLASS_HERO,
  GLASS_INNER_PANEL,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PAGE_BG,
  GLASS_PAGE_SUBTITLE,
  GLASS_PAGE_TITLE,
  GLASS_SECTION,
  GLASS_SECTION_TITLE,
  GLASS_STAT_CARD,
} from "../components/behavioral-coach/glassStyles";
import {
  getAutopilotSettings,
  saveAutopilotKeys,
  saveAutopilotSettings,
  toggleAutopilot,
  type AlpacaAutopilotMode,
  type AutopilotSettingsPayload,
  type AutopilotStatsPayload,
} from "../services/api";
import { colors } from "../styles/designSystem";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatDate } from "../utils/formatters";

const CAPITAL_PCT_MIN = 0.5;
const CAPITAL_PCT_MAX = 10;
const CAPITAL_PCT_STEP = 0.5;
const DRAWDOWN_PCT_MIN = 1;
const DRAWDOWN_PCT_MAX = 50;
const DRAWDOWN_PCT_STEP = 1;

function decimalStringToPercent(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed * 1000) / 10;
}

function formatPercentLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

function AutopilotSettingsSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className={`${GLASS_HERO} animate-pulse`}>
        <div className="h-10 w-2/3 rounded-xl bg-white/10" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-white/10" />
      </div>
      {[1, 2, 3, 4].map((section) => (
        <div key={section} className={`${GLASS_SECTION} animate-pulse space-y-4`}>
          <div className="h-4 w-40 rounded bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-24 rounded-xl bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function AutopilotSettings() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage || i18n.language || "pl").trim();

  const [isLoading, setIsLoading] = useState(true);
  const [isAutopilotEnabled, setIsAutopilotEnabled] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [alpacaMode, setAlpacaMode] = useState<AlpacaAutopilotMode>("PAPER");
  const [capitalPct, setCapitalPct] = useState(2);
  const [drawdownPct, setDrawdownPct] = useState(5);
  const [stats, setStats] = useState<AutopilotStatsPayload | null>(null);

  const [alpacaApiKey, setAlpacaApiKey] = useState("");
  const [alpacaApiSecret, setAlpacaApiSecret] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);

  const [toggleSaving, setToggleSaving] = useState(false);
  const [keysSaving, setKeysSaving] = useState(false);
  const [riskSaving, setRiskSaving] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<FeedbackToast[]>([]);

  const pushToast = useCallback((tone: FeedbackToast["tone"], title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.slice(-2), { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3400);
  }, []);

  const applySettings = useCallback((settings: AutopilotSettingsPayload) => {
    setIsAutopilotEnabled(settings.isAutopilotEnabled);
    setHasKeys(settings.hasKeys);
    setAlpacaMode(settings.alpacaMode);
    setCapitalPct(decimalStringToPercent(settings.maxCapitalPerTradePct, 2));
    setDrawdownPct(decimalStringToPercent(settings.maxDailyDrawdownPct, 5));
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setFieldErrors({});
    try {
      const payload = await getAutopilotSettings();
      applySettings(payload.settings);
      setStats(payload.stats);
    } catch (error) {
      pushToast(
        "error",
        t("autopilot.loadErrorTitle", { defaultValue: "Nie udało się załadować ustawień" }),
        apiErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  }, [applySettings, pushToast, t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const toggleDisabled = useMemo(() => !hasKeys || toggleSaving, [hasKeys, toggleSaving]);

  async function handleToggle(nextEnabled: boolean): Promise<void> {
    if (nextEnabled && !hasKeys) {
      setFieldErrors((prev) => ({
        ...prev,
        toggle: t("autopilot.keysRequiredWarning", {
          defaultValue: "Wprowadź klucze API Alpaca przed aktywacją Autopilota",
        }),
      }));
      return;
    }

    setToggleSaving(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.toggle;
      return next;
    });

    try {
      const result = await toggleAutopilot(nextEnabled);
      setIsAutopilotEnabled(result.isAutopilotEnabled);
      setHasKeys(result.hasKeys);
      pushToast(
        "success",
        result.isAutopilotEnabled
          ? t("autopilot.enabledToast", { defaultValue: "Autopilot włączony" })
          : t("autopilot.disabledToast", { defaultValue: "Autopilot wyłączony" }),
      );
    } catch (error) {
      const message = apiErrorMessage(error);
      setFieldErrors((prev) => ({ ...prev, toggle: message }));
      pushToast("error", t("autopilot.toggleErrorTitle", { defaultValue: "Błąd przełącznika" }), message);
    } finally {
      setToggleSaving(false);
    }
  }

  async function handleSaveKeys(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.alpacaApiKey;
      delete next.alpacaApiSecret;
      return next;
    });

    const trimmedKey = alpacaApiKey.trim();
    const trimmedSecret = alpacaApiSecret.trim();
    const nextErrors: Record<string, string> = {};
    if (!trimmedKey) {
      nextErrors.alpacaApiKey = t("autopilot.apiKeyRequired", { defaultValue: "Klucz API jest wymagany" });
    }
    if (!trimmedSecret) {
      nextErrors.alpacaApiSecret = t("autopilot.apiSecretRequired", { defaultValue: "Sekret API jest wymagany" });
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
      return;
    }

    setKeysSaving(true);
    try {
      const result = await saveAutopilotKeys({
        alpacaApiKey: trimmedKey,
        alpacaApiSecret: trimmedSecret,
      });
      setHasKeys(result.hasKeys);
      setAlpacaApiKey("");
      setAlpacaApiSecret("");
      pushToast(
        "success",
        t("autopilot.keysSavedTitle", { defaultValue: "Klucze zapisane" }),
        t("autopilot.keysSavedMessage", {
          defaultValue: "Klucze API Alpaca zostały zaszyfrowane i zapisane bezpiecznie.",
        }),
      );
    } catch (error) {
      const message = apiErrorMessage(error);
      pushToast("error", t("autopilot.keysErrorTitle", { defaultValue: "Błąd zapisu kluczy" }), message);
    } finally {
      setKeysSaving(false);
    }
  }

  async function handleSaveRiskSettings(): Promise<void> {
    if (capitalPct <= CAPITAL_PCT_MIN || drawdownPct <= DRAWDOWN_PCT_MIN) {
      pushToast(
        "error",
        t("autopilot.riskErrorTitle", { defaultValue: "Nieprawidłowe limity" }),
        t("autopilot.riskPositiveRequired", {
          defaultValue: "Wartości procentowe muszą być większe od 0.",
        }),
      );
      return;
    }

    setRiskSaving(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.maxCapitalPerTradePct;
      delete next.maxDailyDrawdownPct;
      delete next.alpacaMode;
      return next;
    });

    try {
      const result = await saveAutopilotSettings({
        maxCapitalPerTradePct: capitalPct / 100,
        maxDailyDrawdownPct: drawdownPct / 100,
        alpacaMode,
      });
      applySettings(result.settings);
      pushToast(
        "success",
        t("autopilot.riskSavedTitle", { defaultValue: "Safe Guard zaktualizowany" }),
        t("autopilot.riskSavedMessage", { defaultValue: "Limity ryzyka zostały zapisane." }),
      );
    } catch (error) {
      const message = apiErrorMessage(error);
      setFieldErrors((prev) => ({ ...prev, risk: message }));
      pushToast("error", t("autopilot.riskErrorTitle", { defaultValue: "Błąd zapisu limitów" }), message);
    } finally {
      setRiskSaving(false);
    }
  }

  async function handleModeChange(mode: AlpacaAutopilotMode): Promise<void> {
    setAlpacaMode(mode);
    setRiskSaving(true);
    try {
      const result = await saveAutopilotSettings({ alpacaMode: mode });
      applySettings(result.settings);
      pushToast(
        "info",
        t("autopilot.modeUpdatedTitle", { defaultValue: "Tryb zaktualizowany" }),
        mode === "LIVE"
          ? t("autopilot.modeLiveActive", { defaultValue: "Tryb LIVE — handel realnym kapitałem." })
          : t("autopilot.modePaperActive", { defaultValue: "Tryb PAPER — symulacja bez ryzyka." }),
      );
    } catch (error) {
      const message = apiErrorMessage(error);
      setFieldErrors((prev) => ({ ...prev, alpacaMode: message }));
      pushToast("error", t("autopilot.modeErrorTitle", { defaultValue: "Błąd zmiany trybu" }), message);
    } finally {
      setRiskSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className={GLASS_PAGE_BG}>
        <AutopilotSettingsSkeleton />
      </div>
    );
  }

  return (
    <div className={`${GLASS_PAGE_BG} pb-16`}>
      <FeedbackToastStack toasts={toasts} />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header className={GLASS_HERO}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#22d3ee]/30 bg-[#22d3ee]/10">
              <BoltIcon className="h-6 w-6 text-[#22d3ee]" aria-hidden />
            </div>
            <div>
              <h1 className={GLASS_PAGE_TITLE}>
                {t("autopilot.title", { defaultValue: "Autopilot AI Agent" })}
              </h1>
              <p className={GLASS_PAGE_SUBTITLE}>
                {t("autopilot.subtitle", {
                  defaultValue:
                    "Skonfiguruj autonomicznego agenta AI z szyfrowanymi kluczami Alpaca i twardymi limitami Safe Guard.",
                })}
              </p>
            </div>
          </div>
        </header>

        {/* Section 1: Status toggle */}
        <section className={`${GLASS_SECTION} space-y-4`}>
          <p className={GLASS_SECTION_TITLE}>
            {t("autopilot.statusSection", { defaultValue: "Status Autopilota" })}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">
                {isAutopilotEnabled
                  ? t("autopilot.statusActive", { defaultValue: "Autopilot aktywny" })
                  : t("autopilot.statusInactive", { defaultValue: "Autopilot nieaktywny" })}
              </p>
              <p className="text-sm text-[#94a3b8]">
                {t("autopilot.statusHint", {
                  defaultValue: "Agent może wykonywać zlecenia zgodnie z limitami Safe Guard.",
                })}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isAutopilotEnabled}
              aria-label={t("autopilot.toggleLabel", { defaultValue: "Przełącz Autopilot" })}
              disabled={toggleDisabled}
              onClick={() => void handleToggle(!isAutopilotEnabled)}
              className={`relative h-9 w-[4.5rem] shrink-0 rounded-full border transition-all duration-300 ${
                toggleDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
              style={{
                backgroundColor: isAutopilotEnabled ? colors.brandCyan : colors.bgTertiary,
                borderColor: isAutopilotEnabled ? colors.brandCyan : colors.borderStrong,
                boxShadow: isAutopilotEnabled ? "0 0 24px rgba(34,211,238,0.35)" : "none",
              }}
            >
              <span
                className="absolute top-1 rounded-full bg-white shadow-md transition-transform duration-300"
                style={{
                  width: "28px",
                  height: "28px",
                  transform: isAutopilotEnabled ? "translateX(38px)" : "translateX(4px)",
                }}
              />
            </button>
          </div>

          {!hasKeys ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-300">
              {t("autopilot.keysRequiredWarning", {
                defaultValue: "Wprowadź klucze API Alpaca przed aktywacją Autopilota",
              })}
            </p>
          ) : null}

          {fieldErrors.toggle ? <p className="text-sm text-[#f87171]">{fieldErrors.toggle}</p> : null}
          {toggleSaving ? (
            <p className="text-sm text-[#94a3b8]">{t("common.loading", { defaultValue: "Ładowanie…" })}</p>
          ) : null}
        </section>

        {/* Section 2: API keys */}
        <section className={`${GLASS_SECTION} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5 text-[#22d3ee]" aria-hidden />
              <p className={GLASS_SECTION_TITLE}>
                {t("autopilot.keysSection", { defaultValue: "Klucze API Alpaca (BYOK)" })}
              </p>
            </div>
            {hasKeys ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4ade80]/40 bg-[#4ade80]/10 px-3 py-1 text-xs font-semibold text-[#4ade80]">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden />
                {t("autopilot.keysConfiguredBadge", {
                  defaultValue: "Klucze API skonfigurowane bezpiecznie (AES-256-GCM)",
                })}
              </span>
            ) : null}
          </div>

          <p className="text-sm text-[#94a3b8]">
            {t("autopilot.keysHint", {
              defaultValue:
                "Klucze są szyfrowane po stronie serwera i nigdy nie są zwracane do przeglądarki. Możesz je nadpisać w dowolnym momencie.",
            })}
          </p>

          <form onSubmit={(event) => void handleSaveKeys(event)} className="space-y-4">
            <label className="block space-y-2">
              <span className={GLASS_LABEL}>{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={alpacaApiKey}
                  onChange={(event) => setAlpacaApiKey(event.target.value)}
                  autoComplete="off"
                  className={`${GLASS_INPUT} pr-11`}
                  placeholder={hasKeys ? "••••••••••••••••" : "PK..."}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-white/10 hover:text-white"
                  aria-label={
                    showApiKey
                      ? t("autopilot.hideKey", { defaultValue: "Ukryj klucz" })
                      : t("autopilot.showKey", { defaultValue: "Pokaż klucz" })
                  }
                >
                  {showApiKey ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {fieldErrors.alpacaApiKey ? (
                <p className="text-sm text-[#f87171]">{fieldErrors.alpacaApiKey}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className={GLASS_LABEL}>{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
              <div className="relative">
                <input
                  type={showApiSecret ? "text" : "password"}
                  value={alpacaApiSecret}
                  onChange={(event) => setAlpacaApiSecret(event.target.value)}
                  autoComplete="off"
                  className={`${GLASS_INPUT} pr-11`}
                  placeholder={hasKeys ? "••••••••••••••••" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowApiSecret((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-white/10 hover:text-white"
                  aria-label={
                    showApiSecret
                      ? t("autopilot.hideSecret", { defaultValue: "Ukryj sekret" })
                      : t("autopilot.showSecret", { defaultValue: "Pokaż sekret" })
                  }
                >
                  {showApiSecret ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
              {fieldErrors.alpacaApiSecret ? (
                <p className="text-sm text-[#f87171]">{fieldErrors.alpacaApiSecret}</p>
              ) : null}
            </label>

            <button type="submit" disabled={keysSaving} className={GLASS_BTN_PRIMARY}>
              {keysSaving
                ? t("common.loading", { defaultValue: "Ładowanie…" })
                : t("autopilot.saveKeys", { defaultValue: "Zapisz klucze API" })}
            </button>
          </form>
        </section>

        {/* Section 3: Safe Guard */}
        <section className={`${GLASS_SECTION} space-y-5`}>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-[#a855f7]" aria-hidden />
            <p className={GLASS_SECTION_TITLE}>
              {t("autopilot.safeGuardSection", { defaultValue: "Safe Guard — limity ryzyka" })}
            </p>
          </div>

          <div className={`${GLASS_INNER_PANEL} space-y-3 p-4`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94a3b8]">
                {t("autopilot.maxCapitalPerTrade", { defaultValue: "Maks. kapitał na transakcję" })}
              </span>
              <span className="font-mono text-lg font-semibold text-[#22d3ee]">
                {formatPercentLabel(capitalPct)}
              </span>
            </div>
            <input
              type="range"
              min={CAPITAL_PCT_MIN}
              max={CAPITAL_PCT_MAX}
              step={CAPITAL_PCT_STEP}
              value={capitalPct}
              disabled={riskSaving}
              onChange={(event) => setCapitalPct(Number(event.target.value))}
              className="w-full accent-[#a855f7]"
            />
            <p className="text-xs text-white/50">
              {t("autopilot.maxCapitalHint", {
                defaultValue: "Zakres: 0.5% – 10.0%. Agent nie przekroczy tego limitu na pojedyncze zlecenie BUY.",
              })}
            </p>
            {fieldErrors.maxCapitalPerTradePct ? (
              <p className="text-sm text-[#f87171]">{fieldErrors.maxCapitalPerTradePct}</p>
            ) : null}
          </div>

          <div className={`${GLASS_INNER_PANEL} space-y-3 p-4`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94a3b8]">
                {t("autopilot.maxDailyDrawdown", { defaultValue: "Maks. dzienny drawdown" })}
              </span>
              <span className="font-mono text-lg font-semibold text-[#22d3ee]">
                {formatPercentLabel(drawdownPct)}
              </span>
            </div>
            <input
              type="range"
              min={DRAWDOWN_PCT_MIN}
              max={DRAWDOWN_PCT_MAX}
              step={DRAWDOWN_PCT_STEP}
              value={drawdownPct}
              disabled={riskSaving}
              onChange={(event) => setDrawdownPct(Number(event.target.value))}
              className="w-full accent-[#a855f7]"
            />
            <p className="text-xs text-white/50">
              {t("autopilot.maxDrawdownHint", {
                defaultValue: "Zakres: 1% – 50%. Przekroczenie blokuje nowe zlecenia do końca doby.",
              })}
            </p>
            {fieldErrors.maxDailyDrawdownPct ? (
              <p className="text-sm text-[#f87171]">{fieldErrors.maxDailyDrawdownPct}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <span className={GLASS_LABEL}>{t("autopilot.modeLabel", { defaultValue: "Tryb Alpaca" })}</span>
            <div className="inline-flex rounded-xl border border-white/10 bg-[#0f111c]/80 p-1 backdrop-blur-sm">
              {(["PAPER", "LIVE"] as const).map((mode) => {
                const active = alpacaMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={riskSaving}
                    onClick={() => void handleModeChange(mode)}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200"
                    style={{
                      color: active ? "#fff" : colors.textSecondary,
                      backgroundColor: active
                        ? mode === "LIVE"
                          ? colors.negative
                          : colors.brandDark
                        : "transparent",
                      boxShadow: active ? "0 4px 20px rgba(168,85,247,0.35)" : "none",
                    }}
                  >
                    {mode === "PAPER"
                      ? t("alpaca.modePaper", { defaultValue: "PAPER" })
                      : t("alpaca.modeLive", { defaultValue: "LIVE" })}
                  </button>
                );
              })}
            </div>
            {alpacaMode === "LIVE" ? (
              <p className="animate-pulse rounded-xl border border-[#f87171]/50 bg-[#f87171]/10 px-4 py-3 text-sm font-semibold text-[#f87171]">
                {t("autopilot.liveWarning", {
                  defaultValue:
                    "UWAGA: Tryb LIVE handluje realnym kapitałem. Upewnij się, że limity Safe Guard są poprawnie skonfigurowane.",
                })}
              </p>
            ) : null}
            {fieldErrors.alpacaMode ? <p className="text-sm text-[#f87171]">{fieldErrors.alpacaMode}</p> : null}
          </div>

          {fieldErrors.risk ? <p className="text-sm text-[#f87171]">{fieldErrors.risk}</p> : null}

          <button
            type="button"
            disabled={riskSaving}
            onClick={() => void handleSaveRiskSettings()}
            className={GLASS_BTN_SECONDARY}
          >
            {riskSaving
              ? t("common.loading", { defaultValue: "Ładowanie…" })
              : t("autopilot.saveRisk", { defaultValue: "Zapisz limity Safe Guard" })}
          </button>
        </section>

        {/* Section 4: Stats */}
        <section className={`${GLASS_SECTION} space-y-4`}>
          <div className="flex items-center gap-2">
            <ChartBarSquareIcon className="h-5 w-5 text-[#22d3ee]" aria-hidden />
            <p className={GLASS_SECTION_TITLE}>
              {t("autopilot.statsSection", { defaultValue: "Statystyki wykonania" })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className={`${GLASS_STAT_CARD} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {t("autopilot.totalTrades", { defaultValue: "Wykonane transakcje" })}
              </p>
              <p className="mt-3 font-mono text-4xl font-bold text-white">
                {stats?.totalTradesExecuted ?? 0}
              </p>
            </article>

            <article className={`${GLASS_STAT_CARD} p-5`}>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-[#94a3b8]" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                  {t("autopilot.lastExecuted", { defaultValue: "Ostatnie wykonanie" })}
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-white">
                {stats?.lastExecutedAt
                  ? formatDate(stats.lastExecutedAt, locale)
                  : t("autopilot.neverExecuted", { defaultValue: "Brak wykonań" })}
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
