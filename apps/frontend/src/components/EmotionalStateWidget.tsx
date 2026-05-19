import { HeartIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  getEmotionalStatus,
  trackEmotionalState,
  type EmotionalLevel,
} from "../services/api";

const PULSE_MS = 60_000;
const USER_ID_FALLBACK = "";

type EmotionalStateWidgetProps = {
  variant?: "floating" | "compact";
};

function parseUserId(): string {
  const stored = globalThis.localStorage?.getItem("userId")?.trim();
  return stored || USER_ID_FALLBACK;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function looksLikeTradeIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /(trade|buy|sell|open position|close position|confirm|otwórz|zamknij|kup|sprzedaj)/.test(t);
}

function getElementText(target: EventTarget | null): string {
  const node = target as HTMLElement | null;
  if (!node) return "";
  const own = node.textContent?.trim() ?? "";
  if (own) return own;
  if (node instanceof HTMLInputElement && node.value) return node.value;
  return "";
}

function levelColor(level: EmotionalLevel): string {
  if (level === "HIGH") return "text-red-300";
  if (level === "MEDIUM") return "text-yellow-300";
  return "text-emerald-300";
}

function levelColorCompact(level: EmotionalLevel): string {
  if (level === "HIGH") return "text-negative";
  if (level === "MEDIUM") return "text-brandGold";
  return "text-positive";
}

export function EmotionalStateWidget({ variant = "floating" }: EmotionalStateWidgetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userIdRef = useRef(user?.id ?? parseUserId());
  const clickCountRef = useRef(0);
  const tradeTimestampsRef = useRef<number[]>([]);
  const decisionStartRef = useRef<number | null>(null);
  const decisionDurationsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const [level, setLevel] = useState<EmotionalLevel>("LOW");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [stressDetected, setStressDetected] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    userIdRef.current = user?.id ?? parseUserId();
  }, [user?.id]);

  useEffect(() => {
    const clickListener = (event: MouseEvent) => {
      clickCountRef.current += 1;
      const text = getElementText(event.target);
      if (!looksLikeTradeIntent(text)) return;

      const now = Date.now();
      tradeTimestampsRef.current.push(now);
      if (decisionStartRef.current == null) {
        decisionStartRef.current = now;
        return;
      }

      const dt = (now - decisionStartRef.current) / 1000;
      decisionStartRef.current = null;
      if (Number.isFinite(dt) && dt > 0) {
        decisionDurationsRef.current.push(clamp(dt, 0.25, 600));
        decisionDurationsRef.current = decisionDurationsRef.current.slice(-30);
      }
    };

    document.addEventListener("click", clickListener, { passive: true });
    return () => document.removeEventListener("click", clickListener);
  }, []);

  useEffect(() => {
    async function syncInitialStatus(): Promise<void> {
      try {
        const status = await getEmotionalStatus(userIdRef.current);
        if (!mountedRef.current) return;
        setLevel(status.currentLevel);
        setSuggestion(status.suggestion);
        setLastChecked(status.lastChecked);
        setStressDetected(status.currentLevel !== "LOW");
      } catch {
        // Optional status hydration; ignore failures.
      }
    }
    void syncInitialStatus();
  }, []);

  useEffect(() => {
    async function flushMetrics(): Promise<void> {
      const now = Date.now();
      tradeTimestampsRef.current = tradeTimestampsRef.current.filter((ts) => now - ts <= 60 * 60 * 1000);

      const durations = decisionDurationsRef.current;
      const avgDecisionTime =
        durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 8;

      const payload = {
        userId: userIdRef.current,
        clickRate: clickCountRef.current,
        tradeFrequency: tradeTimestampsRef.current.length,
        avgDecisionTime,
      };

      clickCountRef.current = 0;

      try {
        const result = await trackEmotionalState(payload);
        if (!mountedRef.current) return;
        setLevel(result.level);
        setSuggestion(result.suggestion);
        setLastChecked(new Date().toISOString());
        setStressDetected(result.stressDetected);
      } catch {
        if (!mountedRef.current) return;
        setLastChecked(new Date().toISOString());
      }
    }

    const timer = setInterval(() => {
      void flushMetrics();
    }, PULSE_MS);
    void flushMetrics();

    return () => clearInterval(timer);
  }, []);

  const bannerClass = useMemo(() => {
    if (!stressDetected) return "";
    return level === "HIGH"
      ? "border-red-400/60 bg-red-500/20 text-red-100"
      : "border-yellow-400/60 bg-yellow-500/20 text-yellow-100";
  }, [level, stressDetected]);

  const dotClass = useMemo(() => {
    if (level === "HIGH") return "bg-red-400 ring-red-400/40";
    if (level === "MEDIUM") return "bg-yellow-400 ring-yellow-400/40";
    return "bg-emerald-400 ring-emerald-400/40";
  }, [level]);

  if (variant === "compact") {
    return (
      <section className="rounded-2xl border border-border bg-bgPrimary p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-textSecondary">{t("emotional.widgetTitle")}</p>
            <p className={`mt-1 text-2xl font-semibold ${levelColorCompact(level)}`}>{t(`emotional.level.${level}`)}</p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              stressDetected ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"
            }`}
          >
            {stressDetected ? "Uwaga" : "Stabilny"}
          </span>
        </div>

        <p className="mt-2 text-xs text-textSecondary">
          {t("emotional.lastChecked")}:{" "}
          <span className="font-medium text-textPrimary">{lastChecked ? new Date(lastChecked).toLocaleTimeString() : "-"}</span>
        </p>

        {suggestion ? (
          <p className="mt-3 rounded-lg border border-border bg-bgSecondary px-3 py-2 text-sm text-textSecondary">{suggestion}</p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {expanded && stressDetected && suggestion ? (
        <div
          className={`fixed left-1/2 top-2 z-[70] w-[min(92vw,800px)] -translate-x-1/2 rounded-lg border px-4 py-2 text-sm ${bannerClass}`}
          role="status"
        >
          <span className="font-semibold">{t("emotional.alertTitle")}:</span> {suggestion}
        </div>
      ) : null}

      <button
        type="button"
        className="fixed bottom-6 right-4 z-[65] flex h-11 w-11 items-center justify-center rounded-full border border-slate-600/80 bg-slate-900/95 text-slate-200 shadow-lg backdrop-blur transition hover:border-slate-500 hover:bg-slate-800"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={t("emotional.widgetTitle")}
        title={t(`emotional.level.${level}`)}
      >
        <HeartIcon className="h-5 w-5" aria-hidden />
        <span
          className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ${dotClass} ${stressDetected ? "animate-pulse" : ""}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <aside className="fixed bottom-20 right-4 z-[65] w-56 rounded-lg border border-slate-700/80 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("emotional.widgetTitle")}</div>
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              onClick={() => setExpanded(false)}
              aria-label={t("common.close", { defaultValue: "Close" })}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className={`mt-1 text-lg font-semibold ${levelColor(level)}`}>{t(`emotional.level.${level}`)}</div>
          <div className="mt-2 text-xs text-slate-400">
            {t("emotional.lastChecked")}:{" "}
            <span className="text-slate-200">{lastChecked ? new Date(lastChecked).toLocaleTimeString() : "-"}</span>
          </div>
          {suggestion ? <p className="mt-3 text-xs leading-relaxed text-slate-300">{suggestion}</p> : null}
        </aside>
      ) : null}
    </>
  );
}
