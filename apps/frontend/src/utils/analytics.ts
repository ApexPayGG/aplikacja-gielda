import { getCookieConsent } from "./cookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __stockAiGaInitialized?: boolean;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "G-PLACEHOLDER";
const GA_SCRIPT_SELECTOR = 'script[data-stockai-ga4="true"]';

function canUseAnalytics(): boolean {
  return getCookieConsent() === "all";
}

function hasValidMeasurementId(): boolean {
  return GA_MEASUREMENT_ID !== "G-PLACEHOLDER";
}

export function initializeGA4(): void {
  if (typeof window === "undefined" || !canUseAnalytics() || !hasValidMeasurementId() || window.__stockAiGaInitialized) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  const existingScript = document.querySelector(GA_SCRIPT_SELECTOR);
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.setAttribute("data-stockai-ga4", "true");
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
  window.__stockAiGaInitialized = true;
}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined" || !canUseAnalytics()) {
    return;
  }

  initializeGA4();
  if (window.gtag) {
    window.gtag("event", name, params);
  }
}
