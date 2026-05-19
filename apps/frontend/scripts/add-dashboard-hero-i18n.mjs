#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, "..", "public", "locales");

const PATCH = {
  en: {
    dashboard: {
      greetingGeneric: "Welcome back",
      statNoData: "—",
      hero: {
        eyebrow: "Your StockAI hub",
        title: "Build your market watchlist",
        subtitle:
          "Add a few tickers to unlock live quotes, movement alerts, and AI context tailored to what you actually trade.",
        step1: "Pick companies you follow",
        step2: "Read AI briefs and signals",
        step3: "Track mindset with the coach",
        ctaBrowse: "Browse companies",
        ctaSignals: "View signals",
        popularLabel: "Popular to start",
      },
      emptyWatchlistCta: "Add your first company",
      emptySignalsHint: "Signals appear when your watchlist moves ±2% intraday.",
    },
    checkin: {
      title: "Daily Check-In",
      subtitle: "Set your mindset before the market opens.",
      moodLabel: "Mood",
      planLabel: "What is your plan today?",
      planPlaceholder: "Optional...",
      submit: "Start trading day",
      submitting: "Saving...",
      error: "Could not save check-in. Please try again.",
      risk: { LOW: "Low", MEDIUM: "Medium", HIGH: "High" },
    },
    legal: { showDisclaimer: "Investment disclaimer" },
  },
  pl: {
    dashboard: {
      greetingGeneric: "Witaj ponownie",
      statNoData: "—",
      hero: {
        eyebrow: "Twój hub StockAI",
        title: "Zbuduj swoją watchlistę",
        subtitle:
          "Dodaj kilka tickerów, aby odblokować notowania na żywo, alerty ruchu i kontekst AI dopasowany do tego, czym faktycznie handlujesz.",
        step1: "Wybierz spółki, które śledzisz",
        step2: "Czytaj AI Brief i sygnały",
        step3: "Monitoruj psychikę z coachem",
        ctaBrowse: "Przeglądaj spółki",
        ctaSignals: "Zobacz sygnały",
        popularLabel: "Popularne na start",
      },
      emptyWatchlistCta: "Dodaj pierwszą spółkę",
      emptySignalsHint: "Sygnały pojawią się, gdy spółka z watchlisty zmieni się o ±2% w sesji.",
    },
    checkin: {
      title: "Codzienny check-in",
      subtitle: "Ustaw nastawienie przed otwarciem rynku.",
      moodLabel: "Nastrój",
      planLabel: "Jaki jest Twój plan na dziś?",
      planPlaceholder: "Opcjonalnie…",
      submit: "Rozpocznij dzień tradingowy",
      submitting: "Zapisywanie…",
      error: "Nie udało się zapisać check-inu. Spróbuj ponownie.",
      risk: { LOW: "Niski", MEDIUM: "Średni", HIGH: "Wysoki" },
    },
    legal: { showDisclaimer: "Zastrzeżenie inwestycyjne" },
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
  if (patch.dashboard) data.dashboard = deepMerge(data.dashboard ?? {}, patch.dashboard);
  if (patch.checkin) data.checkin = deepMerge(data.checkin ?? {}, patch.checkin);
  if (patch.legal) data.legal = deepMerge(data.legal ?? {}, patch.legal);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Patched ${lng}/common.json`);
}
