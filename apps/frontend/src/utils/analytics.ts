import { getCookieConsent } from "./cookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __stockAiGaInitialized?: boolean;
  }
}

const GA_MEASUREMENT_ID = "G-XE45H4W6BW";
const GA_SCRIPT_SELECTOR = 'script[data-stockai-ga4="true"]';

function getMeasurementId(): string {
  const raw = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!raw || raw === "G-PLACEHOLDER") {
    return GA_MEASUREMENT_ID;
  }
  return raw;
}

function canUseAnalytics(): boolean {
  return getCookieConsent() === "all";
}

export function isGa4Configured(): boolean {
  return Boolean(getMeasurementId());
}

export function initializeGA4(): void {
  const measurementId = getMeasurementId();
  if (
    typeof window === "undefined" ||
    !measurementId ||
    !canUseAnalytics() ||
    window.__stockAiGaInitialized
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  const existingScript =
    document.querySelector(GA_SCRIPT_SELECTOR) ||
    document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  if (!existingScript) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.setAttribute("data-stockai-ga4", "true");
    document.head.appendChild(script);
  }

  window.gtag("js", new Date());
  window.gtag("config", measurementId);
  window.__stockAiGaInitialized = true;
}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined" || !canUseAnalytics() || !isGa4Configured()) {
    return;
  }

  initializeGA4();
  if (window.gtag) {
    window.gtag("event", name, params);
  }
}
