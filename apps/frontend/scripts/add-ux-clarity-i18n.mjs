#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");

const PATCH = {
  en: {
    nav: { shortcutsHint: "Press ? for keyboard shortcuts", companies: "Companies" },
    auth: {
      loginSubtitle: "Sign in to continue on StockAI Pro.",
      verifyEmailSuccess: "Email verified! You can sign in now.",
      forgotPassword: "Forgot password?",
      loginContinueCheckout: "Sign in to complete your subscription.",
      verifyEmailFirst: "Please verify your email first. Check your inbox for the activation link.",
    },
    dashboard: {
      greeting: "Good morning, {{name}}",
      watchlistTitle: "Watchlist",
      watchlistCount: "{{count}} companies",
      signalsTitle: "Recent signals",
      signalsEmpty: "No signals in the latest snapshot.",
      signalLong: "LONG",
      signalShort: "SHORT",
      statSignals: "Active signals",
      statWatchlist: "On watchlist",
      statWinRate: "Win rate",
      statStreak: "Positive streak",
    },
    company: {
      notFound: "Company not found",
      lastClose: "Last close",
      premiumAnalysis: "Premium Analysis",
      priceChart: "Price chart",
      ohlcSession: "Latest session (OHLCV)",
      fundamentals: "Fundamentals",
      tabs: {
        overview: "Overview",
        aiBrief: "AI Brief",
        signals: "Signals",
        dividend: "Dividend",
        premiumAnalysis: "Premium Analysis",
      },
    },
    home: { retry: "Try again", partialError: "Some sectors failed to load. Showing available results." },
  },
  pl: {
    nav: { shortcutsHint: "Naciśnij ? aby zobaczyć skróty", companies: "Spółki" },
    auth: {
      loginSubtitle: "Zaloguj się, aby kontynuować pracę z platformą.",
      verifyEmailSuccess: "Email zweryfikowany! Możesz się zalogować.",
      forgotPassword: "Nie pamiętasz hasła?",
      loginContinueCheckout: "Zaloguj się, aby dokończyć subskrypcję.",
      verifyEmailFirst: "Zweryfikuj adres e-mail — sprawdź skrzynkę i kliknij link aktywacyjny.",
    },
    dashboard: {
      greeting: "Dzień dobry, {{name}}",
      watchlistTitle: "Watchlista",
      watchlistCount: "{{count}} spółek",
      signalsTitle: "Ostatnie sygnały",
      signalsEmpty: "Brak sygnałów w ostatnim odczycie.",
      signalLong: "LONG",
      signalShort: "SHORT",
      statSignals: "Aktywne sygnały",
      statWatchlist: "Na watchliście",
      statWinRate: "Win rate",
      statStreak: "Seria wzrostów",
    },
    company: {
      notFound: "Nie znaleziono spółki",
      lastClose: "Ostatnie zamknięcie",
      premiumAnalysis: "Analiza Premium",
      priceChart: "Wykres ceny",
      ohlcSession: "Ostatnia sesja (OHLCV)",
      fundamentals: "Fundamenty",
      tabs: {
        overview: "Przegląd",
        aiBrief: "AI Brief",
        signals: "Sygnały",
        dividend: "Dywidenda",
        premiumAnalysis: "Analiza Premium",
      },
    },
    home: { retry: "Spróbuj ponownie", partialError: "Część sektorów nie załadowała się. Pokazuję dostępne wyniki." },
  },
};

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] ?? {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

for (const lng of ["en", "pl", "de", "es", "fr", "ja", "hi", "ko", "zh-TW"]) {
  const file = path.join(LOCALES_DIR, lng, "common.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const patch = PATCH[lng] ?? PATCH.en;
  if (patch.nav) data.nav = deepMerge(data.nav ?? {}, patch.nav);
  if (patch.auth) data.auth = deepMerge(data.auth ?? {}, patch.auth);
  if (patch.dashboard) data.dashboard = deepMerge(data.dashboard ?? {}, patch.dashboard);
  if (patch.company) data.company = deepMerge(data.company ?? {}, patch.company);
  if (patch.home) data.home = deepMerge(data.home ?? {}, patch.home);
  if (data.landing?.pricing?.tiers?.pro) {
    data.landing.pricing.tiers.pro.cta = "Get Pro";
    data.landing.pricing.tiers.proPlus.cta = "Get Pro+";
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Patched ${lng}/common.json`);
}
