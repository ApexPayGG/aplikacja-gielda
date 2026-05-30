import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getCookieConsent, setCookieConsent } from "../cookieConsent.js";
import {
  ANALYTICS_EVENTS,
  captureUtmOnce,
  getStoredUtmParams,
  mergeConversionParams,
  readUtmFromSearch,
  trackConversionEvent,
  trackEvent,
} from "../analytics.js";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("analytics utilities", () => {
  const gtagCalls: unknown[][] = [];

  function resetGtagCalls(): void {
    gtagCalls.length = 0;
  }

  function gtagStub(...args: unknown[]): void {
    gtagCalls.push(args);
  }

  beforeEach(() => {
    const sessionStore = createMemoryStorage();
    const localStore = createMemoryStorage();
    resetGtagCalls();

    (globalThis as { window?: Window; localStorage?: Storage; sessionStorage?: Storage }).window = {
      location: { search: "?utm_source=google&utm_campaign=spring" },
      sessionStorage: sessionStore,
      localStorage: localStore,
      document: {
        title: "Test",
        head: { appendChild: () => {} },
        querySelector: () => null,
        createElement: () => ({ async: true, setAttribute: () => {}, src: "" }),
      },
      dataLayer: [],
      gtag: gtagStub,
      __stockAiGaInitialized: true,
    } as unknown as Window;
    globalThis.localStorage = localStore;
    globalThis.sessionStorage = sessionStore;
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
    globalThis.sessionStorage?.clear();
  });

  it("readUtmFromSearch extracts attribution keys and drops email", () => {
    const utm = readUtmFromSearch("?utm_source=newsletter&gclid=abc&email=secret@x.com");
    assert.equal(utm.utm_source, "newsletter");
    assert.equal(utm.gclid, "abc");
    assert.equal(utm.email, undefined);
  });

  it("captureUtmOnce stores UTM once in sessionStorage", () => {
    captureUtmOnce();
    captureUtmOnce();
    assert.equal(getStoredUtmParams().utm_source, "google");
    assert.equal(getStoredUtmParams().utm_campaign, "spring");
  });

  it("mergeConversionParams attaches stored UTM and locale", () => {
    captureUtmOnce();
    const merged = mergeConversionParams({ plan: "pro" }, "pl");
    assert.equal(merged.plan, "pro");
    assert.equal(merged.locale, "pl");
    assert.equal(merged.utm_source, "google");
  });

  it("does not call gtag when cookie consent is necessary only", () => {
    setCookieConsent("necessary");
    assert.equal(getCookieConsent(), "necessary");
    trackConversionEvent(ANALYTICS_EVENTS.SIGN_UP, { verification_email_sent: 1 });
    assert.equal(gtagCalls.length, 0);
  });

  it("calls gtag when cookie consent is all", () => {
    setCookieConsent("all");
    captureUtmOnce();
    trackConversionEvent(ANALYTICS_EVENTS.SIGN_UP, { verification_email_sent: 1 }, "en");
    assert.equal(gtagCalls.length, 1);
    const args = gtagCalls[0]!;
    assert.equal(args[0], "event");
    assert.equal(args[1], ANALYTICS_EVENTS.SIGN_UP);
    const payload = args[2] as Record<string, unknown>;
    assert.equal(payload.verification_email_sent, 1);
    assert.equal(payload.utm_source, "google");
    assert.equal(payload.locale, "en");
    assert.equal(payload.email, undefined);
  });

  it("trackEvent no-ops when gtag is missing", () => {
    setCookieConsent("all");
    (globalThis as { window?: Window }).window = {
      ...(globalThis as { window: Window }).window,
      gtag: undefined,
    } as Window;
    assert.doesNotThrow(() => trackEvent(ANALYTICS_EVENTS.LOGIN));
  });

  it("blocks sensitive params such as email", () => {
    setCookieConsent("all");
    trackConversionEvent(ANALYTICS_EVENTS.REGISTER_FAILED, {
      email: "a@b.com",
      reason: "request_failed",
    });
    assert.equal(gtagCalls.length, 1);
    const payload = gtagCalls[0]![2] as Record<string, unknown>;
    assert.equal(payload.email, undefined);
    assert.equal(payload.reason, "request_failed");
  });
});
