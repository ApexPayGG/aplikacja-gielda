#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "locales");

const PATCH = {
  en: {
    nav: { searchPlaceholder: "Search company..." },
    dashboard: {
      emptyWatchlistTitle: "🔍 Find your first company",
      emptyWatchlistCta: "Browse companies",
      signalsWaiting: "No signals — the market is waiting for a setup",
      checkIn: { planPlaceholder: "What is your plan today?" },
    },
  },
  pl: {
    nav: { searchPlaceholder: "Szukaj spółki..." },
    dashboard: {
      emptyWatchlistTitle: "🔍 Znajdź swoją pierwszą spółkę",
      emptyWatchlistCta: "Przeglądaj spółki",
      signalsWaiting: "Brak sygnałów — rynek czeka na setup",
      checkIn: { planPlaceholder: "Jaki jest Twój plan na dziś?" },
    },
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
  data.nav = deepMerge(data.nav ?? {}, patch.nav);
  data.dashboard = deepMerge(data.dashboard ?? {}, patch.dashboard);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Patched ${lng}/common.json`);
}
