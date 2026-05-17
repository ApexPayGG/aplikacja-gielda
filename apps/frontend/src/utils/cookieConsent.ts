export type CookieConsentType = "all" | "necessary";

const COOKIE_CONSENT_STORAGE_KEY = "cookieConsent";

function isCookieConsentType(value: string | null): value is CookieConsentType {
  return value === "all" || value === "necessary";
}

export function getCookieConsent(): CookieConsentType | null {
  if (typeof window === "undefined") {
    return null;
  }

  const consent = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  return isCookieConsentType(consent) ? consent : null;
}

export function setCookieConsent(type: CookieConsentType): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, type);
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null;
}
