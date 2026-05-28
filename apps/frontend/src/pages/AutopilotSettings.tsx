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
  TERMINAL_APP_BG,
  TERMINAL_BUTTON_PRIMARY,
  TERMINAL_BUTTON_SECONDARY,
  TERMINAL_DANGER_PANEL,
  TERMINAL_FILTER_CHIP,
  TERMINAL_FILTER_CHIP_ACTIVE,
  TERMINAL_FORM_LABEL,
  TERMINAL_ICON_BUTTON,
  TERMINAL_MODE_SWITCH,
  TERMINAL_PAGE_SUBTITLE,
  TERMINAL_PAGE_TITLE,
  TERMINAL_SECRET_FIELD,
  TERMINAL_SECTION_TITLE,
  TERMINAL_SETTINGS_CARD,
  TERMINAL_SETTINGS_PANEL,
  TERMINAL_SETTINGS_ROW,
  TERMINAL_STATUS_CARD,
  TERMINAL_TEXT_MUTED,
  TERMINAL_TOGGLE_THUMB,
  TERMINAL_TOGGLE_TRACK,
  TERMINAL_WARNING_PANEL,
} from "../components/terminal/terminalStyles";
import {
  getAutopilotSettings,
  saveAutopilotKeys,
  saveAutopilotSettings,
  toggleAutopilot,
  type AlpacaAutopilotMode,
  type AutopilotSettingsPayload,
  type AutopilotStatsPayload,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { formatDate } from "../utils/formatters";

const CAPITAL_PCT_MIN = 0.5;
const CAPITAL_PCT_MAX = 10;
const CAPITAL_PCT_STEP = 0.5;
const DRAWDOWN_PCT_MIN = 1;
const DRAWDOWN_PCT_MAX = 20;
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
      <div className={`${TERMINAL_SETTINGS_PANEL} animate-pulse`}>
        <div className="h-10 w-2/3 rounded-lg bg-terminal-panelSecondary" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-terminal-panelSecondary" />
      </div>
      {[1, 2, 3, 4].map((section) => (
        <div key={section} className={`${TERMINAL_SETTINGS_CARD} animate-pulse space-y-4`}>
          <div className="h-4 w-40 rounded bg-terminal-panelSecondary" />
          <div className="h-12 rounded-lg bg-terminal-panelSecondary" />
          <div className="h-24 rounded-lg bg-terminal-panelSecondary" />
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
    setHasKeys(settings.hasAlpacaApiKey && settings.hasAlpacaApiSecret);
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
      setHasKeys(result.hasAlpacaApiKey && result.hasAlpacaApiSecret);
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
      setHasKeys(result.hasAlpacaApiKey && result.hasAlpacaApiSecret);
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
      <div className={TERMINAL_APP_BG}>
        <AutopilotSettingsSkeleton />
      </div>
    );
  }

  return (
    <div className={`${TERMINAL_APP_BG} pb-16`}>
      <FeedbackToastStack toasts={toasts} />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header className={TERMINAL_SETTINGS_PANEL}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/10">
              <BoltIcon className="h-6 w-6 text-terminal-cyan" aria-hidden />
            </div>
            <div>
              <h1 className={TERMINAL_PAGE_TITLE}>
                {t("autopilot.title", { defaultValue: "Autopilot AI Agent" })}
              </h1>
              <p className={TERMINAL_PAGE_SUBTITLE}>
                {t("autopilot.subtitle", {
                  defaultValue:
                    "Skonfiguruj autonomicznego agenta AI z szyfrowanymi kluczami Alpaca i twardymi limitami Safe Guard.",
                })}
              </p>
            </div>
          </div>
        </header>

        {/* Section 1: Status toggle */}
        <section className={`${TERMINAL_SETTINGS_CARD} space-y-4`}>
          <p className={TERMINAL_SECTION_TITLE}>
            {t("autopilot.statusSection", { defaultValue: "Status Autopilota" })}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-terminal-text">
                {isAutopilotEnabled
                  ? t("autopilot.statusActive", { defaultValue: "Autopilot aktywny" })
                  : t("autopilot.statusInactive", { defaultValue: "Autopilot nieaktywny" })}
              </p>
              <p className={TERMINAL_TEXT_MUTED}>
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
              className={`${TERMINAL_TOGGLE_TRACK} ${
                isAutopilotEnabled
                  ? "cursor-pointer border-terminal-cyan/50 bg-terminal-cyan/20 shadow-terminal-glow"
                  : "cursor-pointer border-terminal-borderMuted bg-terminal-panelSecondary"
              } ${toggleDisabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={TERMINAL_TOGGLE_THUMB}
                style={{
                  transform: isAutopilotEnabled ? "translateX(38px)" : "translateX(4px)",
                }}
              />
            </button>
          </div>

          {!hasKeys ? (
            <p className={TERMINAL_WARNING_PANEL}>
              {t("autopilot.keysRequiredWarning", {
                defaultValue: "Wprowadź klucze API Alpaca przed aktywacją Autopilota",
              })}
            </p>
          ) : null}

          {fieldErrors.toggle ? <p className="text-sm text-terminal-negative">{fieldErrors.toggle}</p> : null}
          {toggleSaving ? (
            <p className={TERMINAL_TEXT_MUTED}>{t("common.loading", { defaultValue: "Ładowanie…" })}</p>
          ) : null}
        </section>

        {/* Section 2: API keys */}
        <section className={`${TERMINAL_SETTINGS_CARD} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5 text-terminal-cyan" aria-hidden />
              <p className={TERMINAL_SECTION_TITLE}>
                {t("autopilot.keysSection", { defaultValue: "Klucze API Alpaca (BYOK)" })}
              </p>
            </div>
            {hasKeys ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-terminal-positive/40 bg-terminal-positive/10 px-3 py-1 text-xs font-semibold text-terminal-positive">
                <CheckBadgeIcon className="h-4 w-4" aria-hidden />
                {t("autopilot.keysConfiguredBadge", {
                  defaultValue: "Klucze API skonfigurowane bezpiecznie (AES-256-GCM)",
                })}
              </span>
            ) : null}
          </div>

          <p className={TERMINAL_TEXT_MUTED}>
            {t("autopilot.keysHint", {
              defaultValue:
                "Klucze są szyfrowane po stronie serwera i nigdy nie są zwracane do przeglądarki. Możesz je nadpisać w dowolnym momencie.",
            })}
          </p>

          <form onSubmit={(event) => void handleSaveKeys(event)} className="space-y-4">
            <label className="block space-y-2">
              <span className={TERMINAL_FORM_LABEL}>{t("alpaca.apiKey", { defaultValue: "API Key" })}</span>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={alpacaApiKey}
                  onChange={(event) => setAlpacaApiKey(event.target.value)}
                  autoComplete="off"
                  className={TERMINAL_SECRET_FIELD}
                  placeholder={hasKeys ? "••••••••••••••••" : "PK..."}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${TERMINAL_ICON_BUTTON} p-1.5`}
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
                <p className="text-sm text-terminal-negative">{fieldErrors.alpacaApiKey}</p>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className={TERMINAL_FORM_LABEL}>{t("alpaca.apiSecret", { defaultValue: "API Secret" })}</span>
              <div className="relative">
                <input
                  type={showApiSecret ? "text" : "password"}
                  value={alpacaApiSecret}
                  onChange={(event) => setAlpacaApiSecret(event.target.value)}
                  autoComplete="off"
                  className={TERMINAL_SECRET_FIELD}
                  placeholder={hasKeys ? "••••••••••••••••" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowApiSecret((prev) => !prev)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${TERMINAL_ICON_BUTTON} p-1.5`}
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
                <p className="text-sm text-terminal-negative">{fieldErrors.alpacaApiSecret}</p>
              ) : null}
            </label>

            <button type="submit" disabled={keysSaving} className={TERMINAL_BUTTON_PRIMARY}>
              {keysSaving
                ? t("common.loading", { defaultValue: "Ładowanie…" })
                : t("autopilot.saveKeys", { defaultValue: "Zapisz klucze API" })}
            </button>
          </form>
        </section>

        {/* Section 3: Safe Guard */}
        <section className={`${TERMINAL_SETTINGS_CARD} space-y-5`}>
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-terminal-cyan" aria-hidden />
            <p className={TERMINAL_SECTION_TITLE}>
              {t("autopilot.safeGuardSection", { defaultValue: "Safe Guard — limity ryzyka" })}
            </p>
          </div>

          <div className={`${TERMINAL_SETTINGS_ROW} space-y-3 p-4`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-terminal-textMuted">
                {t("autopilot.maxCapitalPerTrade", { defaultValue: "Maks. kapitał na transakcję" })}
              </span>
              <span className="font-mono text-lg font-semibold text-terminal-cyan">
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
              className="w-full accent-terminal-cyan"
            />
            <p className="text-xs text-terminal-textMuted">
              {t("autopilot.maxCapitalHint", {
                defaultValue: "Zakres: 0.5% – 10.0%. Agent nie przekroczy tego limitu na pojedyncze zlecenie BUY.",
              })}
            </p>
            {fieldErrors.maxCapitalPerTradePct ? (
              <p className="text-sm text-terminal-negative">{fieldErrors.maxCapitalPerTradePct}</p>
            ) : null}
          </div>

          <div className={`${TERMINAL_SETTINGS_ROW} space-y-3 p-4`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-terminal-textMuted">
                {t("autopilot.maxDailyDrawdown", { defaultValue: "Maks. dzienny drawdown" })}
              </span>
              <span className="font-mono text-lg font-semibold text-terminal-cyan">
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
              className="w-full accent-terminal-cyan"
            />
            <p className="text-xs text-terminal-textMuted">
              {t("autopilot.maxDrawdownHint", {
                defaultValue: "Zakres: 1% – 50%. Przekroczenie blokuje nowe zlecenia do końca doby.",
              })}
            </p>
            {fieldErrors.maxDailyDrawdownPct ? (
              <p className="text-sm text-terminal-negative">{fieldErrors.maxDailyDrawdownPct}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <span className={TERMINAL_FORM_LABEL}>{t("autopilot.modeLabel", { defaultValue: "Tryb Alpaca" })}</span>
            <div className={TERMINAL_MODE_SWITCH}>
              {(["PAPER", "LIVE"] as const).map((mode) => {
                const active = alpacaMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={riskSaving}
                    onClick={() => void handleModeChange(mode)}
                    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? mode === "LIVE"
                          ? "bg-terminal-negative/20 text-terminal-negative"
                          : TERMINAL_FILTER_CHIP_ACTIVE
                        : TERMINAL_FILTER_CHIP
                    }`}
                  >
                    {mode === "PAPER"
                      ? t("alpaca.modePaper", { defaultValue: "PAPER" })
                      : t("alpaca.modeLive", { defaultValue: "LIVE" })}
                  </button>
                );
              })}
            </div>
            {alpacaMode === "LIVE" ? (
              <p className={`${TERMINAL_DANGER_PANEL} font-semibold`}>
                {t("autopilot.liveWarning", {
                  defaultValue:
                    "UWAGA: Tryb LIVE handluje realnym kapitałem. Upewnij się, że limity Safe Guard są poprawnie skonfigurowane.",
                })}
              </p>
            ) : null}
            {fieldErrors.alpacaMode ? <p className="text-sm text-terminal-negative">{fieldErrors.alpacaMode}</p> : null}
          </div>

          {fieldErrors.risk ? <p className="text-sm text-terminal-negative">{fieldErrors.risk}</p> : null}

          <button
            type="button"
            disabled={riskSaving}
            onClick={() => void handleSaveRiskSettings()}
            className={TERMINAL_BUTTON_SECONDARY}
          >
            {riskSaving
              ? t("common.loading", { defaultValue: "Ładowanie…" })
              : t("autopilot.saveRisk", { defaultValue: "Zapisz limity Safe Guard" })}
          </button>
        </section>

        {/* Section 4: Stats */}
        <section className={`${TERMINAL_SETTINGS_CARD} space-y-4`}>
          <div className="flex items-center gap-2">
            <ChartBarSquareIcon className="h-5 w-5 text-terminal-cyan" aria-hidden />
            <p className={TERMINAL_SECTION_TITLE}>
              {t("autopilot.statsSection", { defaultValue: "Statystyki wykonania" })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <article className={`${TERMINAL_STATUS_CARD} p-5`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-terminal-textMuted">
                {t("autopilot.totalTrades", { defaultValue: "Wykonane transakcje" })}
              </p>
              <p className="mt-3 font-mono text-4xl font-bold text-terminal-text">
                {stats?.totalTradesExecuted ?? 0}
              </p>
            </article>

            <article className={`${TERMINAL_STATUS_CARD} p-5`}>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-terminal-textMuted" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-widest text-terminal-textMuted">
                  {t("autopilot.lastExecuted", { defaultValue: "Ostatnie wykonanie" })}
                </p>
              </div>
              <p className="mt-3 text-lg font-semibold text-terminal-text">
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
