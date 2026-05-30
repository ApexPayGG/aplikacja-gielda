import { getCookieConsent } from "./cookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __stockAiGaInitialized?: boolean;
  }
}

/** Production builds should set VITE_GA_MEASUREMENT_ID at build time (see .env.production.example). */
const GA_MEASUREMENT_ID = "G-XE45H4W6BW";
const GA_SCRIPT_SELECTOR = 'script[data-stockai-ga4="true"]';
const UTM_STORAGE_KEY = "stockai_utm_v1";

const UTM_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

const BLOCKED_PARAM_KEYS = new Set([
  "email",
  "user_id",
  "userid",
  "userId",
  "token",
  "password",
  "stack",
  "stack_trace",
  "message",
]);

export const ANALYTICS_EVENTS = {
  PAGE_VIEW: "page_view",
  PRICING_PAGE_VIEW: "pricing_page_view",
  SELECT_BILLING_CYCLE: "select_billing_cycle",
  SELECT_PLAN: "select_plan",
  BEGIN_CHECKOUT: "begin_checkout",
  BEGIN_CHECKOUT_FAILED: "begin_checkout_failed",
  PAYMENT_SUCCESS: "payment_success",
  PAYMENT_CANCEL_VIEW: "payment_cancel_view",
  REGISTER_STARTED: "register_started",
  SIGN_UP: "sign_up",
  REGISTER_FAILED: "register_failed",
  LOGIN: "login",
  LOGIN_FAILED: "login_failed",
  VERIFY_EMAIL_REQUIRED: "verify_email_required",
  VERIFY_SUCCESS: "verify_success",
  VERIFY_FAILED: "verify_failed",
  RESEND_VERIFICATION_CLICK: "resend_verification_click",
  RESEND_VERIFICATION_RESULT: "resend_verification_result",
  FORGOT_PASSWORD_REQUESTED: "forgot_password_requested",
  FORGOT_PASSWORD_RESULT: "forgot_password_result",
  RESET_PASSWORD_SUCCESS: "reset_password_success",
  RESET_PASSWORD_FAILED: "reset_password_failed",
  PREMIUM_ANALYSIS_VIEW: "premium_analysis_view",
  AFFILIATE_CLICK: "affiliate_click",
  ERROR: "error",
} as const;

export type ConversionEventParams = Record<string, string | number>;

function runtimeWindow(): Window | undefined {
  if (typeof globalThis === "undefined") return undefined;
  return (globalThis as { window?: Window }).window;
}

function getMeasurementId(): string {
  try {
    const raw = import.meta.env?.VITE_GA_MEASUREMENT_ID?.trim();
    if (!raw || raw === "G-PLACEHOLDER") {
      return GA_MEASUREMENT_ID;
    }
    return raw;
  } catch {
    return GA_MEASUREMENT_ID;
  }
}

export function canUseAnalytics(): boolean {
  return getCookieConsent() === "all";
}

export function isGa4Configured(): boolean {
  return Boolean(getMeasurementId());
}

function sanitizeParams(params?: ConversionEventParams): ConversionEventParams {
  if (!params) return {};
  const safe: ConversionEventParams = {};
  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey || BLOCKED_PARAM_KEYS.has(normalizedKey) || BLOCKED_PARAM_KEYS.has(key)) {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
      continue;
    }
    const asString = String(value).trim();
    if (asString) safe[key] = asString;
  }
  return safe;
}

export function readUtmFromSearch(search: string): ConversionEventParams {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const captured: ConversionEventParams = {};
  for (const key of UTM_QUERY_KEYS) {
    const value = params.get(key)?.trim();
    if (value) captured[key] = value;
  }
  return captured;
}

export function getStoredUtmParams(): ConversionEventParams {
  const win = runtimeWindow();
  if (!win) return {};
  try {
    const raw = win.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return sanitizeParams(parsed as ConversionEventParams);
  } catch {
    return {};
  }
}

export function captureUtmOnce(): void {
  const win = runtimeWindow();
  if (!win) return;
  try {
    if (win.sessionStorage.getItem(UTM_STORAGE_KEY)) return;
    const captured = readUtmFromSearch(win.location.search);
    if (Object.keys(captured).length > 0) {
      win.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(captured));
    }
  } catch {
    // Never block app startup on attribution storage.
  }
}

export function mergeConversionParams(
  params?: ConversionEventParams,
  locale?: string,
): ConversionEventParams {
  const merged: ConversionEventParams = {
    ...getStoredUtmParams(),
    ...sanitizeParams(params),
  };
  const localeValue = locale?.trim();
  if (localeValue) merged.locale = localeValue;
  return merged;
}

/** Safe HTTP failure label for conversion events (no email, no stack). */
export function analyticsFailureReason(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (typeof status === "number") return `http_${status}`;
  }
  return "request_failed";
}

export function initializeGA4(): void {
  try {
    const win = runtimeWindow();
    const measurementId = getMeasurementId();
    if (!win || !measurementId || !canUseAnalytics() || win.__stockAiGaInitialized) {
      return;
    }

    win.dataLayer = win.dataLayer || [];
    win.gtag =
      win.gtag ||
      function gtag(...args: unknown[]) {
        win.dataLayer?.push(args);
      };

    const existingScript =
      win.document.querySelector(GA_SCRIPT_SELECTOR) ||
      win.document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!existingScript) {
      const script = win.document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.setAttribute("data-stockai-ga4", "true");
      win.document.head.appendChild(script);
    }

    win.gtag("js", new Date());
    win.gtag("config", measurementId, { send_page_view: false });
    win.__stockAiGaInitialized = true;
  } catch {
    // Analytics init must never break the app.
  }
}

export function trackPageView(path: string, title?: string, locale?: string): void {
  try {
    const win = runtimeWindow();
    if (!win || !canUseAnalytics() || !isGa4Configured()) {
      return;
    }

    initializeGA4();
    const pagePath = path.startsWith("/") ? path : `/${path}`;
    const pageTitle = title?.trim() || win.document.title;
    const payload = mergeConversionParams(
      {
        page_path: pagePath,
        page_title: pageTitle,
      },
      locale,
    );
    if (win.gtag) {
      win.gtag("event", ANALYTICS_EVENTS.PAGE_VIEW, payload);
    }
  } catch {
    // Never throw from analytics.
  }
}

export function trackEvent(name: string, params?: ConversionEventParams, locale?: string): void {
  try {
    const win = runtimeWindow();
    if (!win || !canUseAnalytics() || !isGa4Configured()) {
      return;
    }

    initializeGA4();
    const payload = mergeConversionParams(params, locale);
    if (win.gtag) {
      win.gtag("event", name, payload);
    }
  } catch {
    // Never throw from analytics.
  }
}

export function trackConversionEvent(
  name: string,
  params?: ConversionEventParams,
  locale?: string,
): void {
  trackEvent(name, params, locale);
}
