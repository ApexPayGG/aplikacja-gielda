export type CookieConsentType = "all" | "necessary";

const COOKIE_CONSENT_STORAGE_KEY = "cookieConsent";

function isCookieConsentType(value: string | null): value is CookieConsentType {
  return value === "all" || value === "necessary";
}

export function getCookieConsent(): CookieConsentType | null {
  const storage = (globalThis as { window?: { localStorage?: Storage } }).window?.localStorage;
  if (!storage) {
    return null;
  }

  const consent = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  return isCookieConsentType(consent) ? consent : null;
}

export function setCookieConsent(type: CookieConsentType): void {
  const storage = (globalThis as { window?: { localStorage?: Storage } }).window?.localStorage;
  if (!storage) {
    return;
  }

  storage.setItem(COOKIE_CONSENT_STORAGE_KEY, type);
}

export function hasCookieConsent(): boolean {
  return getCookieConsent() !== null;
}
