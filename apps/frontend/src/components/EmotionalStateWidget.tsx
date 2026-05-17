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
      {stressDetected && suggestion ? (
        <div className={`fixed left-1/2 top-2 z-[70] w-[min(92vw,800px)] -translate-x-1/2 rounded-lg border px-4 py-2 text-sm ${bannerClass}`}>
          <span className="font-semibold">{t("emotional.alertTitle")}:</span> {suggestion}
        </div>
      ) : null}

      <aside className="fixed right-3 top-20 z-[65] w-56 rounded-lg border border-slate-700/80 bg-slate-900/90 p-3 shadow-xl backdrop-blur">
        <div className="text-xs uppercase tracking-wide text-slate-400">{t("emotional.widgetTitle")}</div>
        <div className={`mt-1 text-lg font-semibold ${levelColor(level)}`}>{t(`emotional.level.${level}`)}</div>
        <div className="mt-2 text-xs text-slate-400">
          {t("emotional.lastChecked")}:{" "}
          <span className="text-slate-200">{lastChecked ? new Date(lastChecked).toLocaleTimeString() : "-"}</span>
        </div>
      </aside>
    </>
  );
}
