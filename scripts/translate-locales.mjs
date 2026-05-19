#!/usr/bin/env node
/**
 * StockAI Pro — AI-powered i18n sync (Claude / Anthropic)
 *
 * Source of truth: apps/frontend/public/locales/{locale}/common.json
 * (i18next namespace "common"; not translation.json)
 *
 * Usage (from repo root):
 *   node scripts/translate-locales.mjs
 *   node scripts/translate-locales.mjs --dry-run
 *   node scripts/translate-locales.mjs --source=en --lang=de
 *   node scripts/translate-locales.mjs --sort-only
 *
 * Requires ANTHROPIC_API_KEY (env or apps/api/.env) unless --dry-run / --sort-only.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const LOCALES_DIR = path.join(REPO_ROOT, "apps", "frontend", "public", "locales");
const LOCALE_FILE = "common.json";

const ALL_LOCALES = ["pl", "en", "de", "es", "ja", "hi", "ko", "zh-TW", "fr"];

const LOCALE_LABELS = {
  pl: "Polish",
  en: "English",
  de: "German",
  es: "Spanish",
  ja: "Japanese",
  hi: "Hindi",
  ko: "Korean",
  "zh-TW": "Traditional Chinese (Taiwan)",
  fr: "French",
};

const SYSTEM_PROMPT = `You are a professional financial translator specializing in stock markets, algorithmic trading, and behavioral finance. Translate the following UI JSON values into the target language. Maintain absolute contextual correctness for professional investors. Do not break JSON structure or formatting parameters (like {{variable}} tokens). Return ONLY a valid JSON object with the exact same keys as the input object. No markdown fences, no commentary.`;

const DEFAULT_MODEL = process.env.ANTHROPIC_I18N_MODEL?.trim() || "claude-sonnet-4-6";
const BATCH_SIZE = Number(process.env.I18N_BATCH_SIZE || 35);

function parseArgs(argv) {
  const opts = {
    source: "en",
    dryRun: false,
    sortOnly: false,
    lang: null,
    maxKeys: Infinity,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--sort-only") opts.sortOnly = true;
    else if (arg.startsWith("--source=")) opts.source = arg.slice("--source=".length);
    else if (arg.startsWith("--lang=")) opts.lang = arg.slice("--lang=".length);
    else if (arg.startsWith("--max-keys=")) opts.maxKeys = Number(arg.slice("--max-keys=".length));
  }
  return opts;
}

function loadEnvFiles() {
  const candidates = [
    path.join(REPO_ROOT, "apps", "api", ".env"),
    path.join(REPO_ROOT, ".env"),
    path.join(REPO_ROOT, "apps", "frontend", ".env"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function readLocaleFile(locale) {
  const filePath = path.join(LOCALES_DIR, locale, LOCALE_FILE);
  if (!fs.existsSync(filePath)) {
    return { filePath, data: {} };
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return { filePath, data: JSON.parse(raw) };
}

function writeLocaleFile(filePath, data) {
  const sorted = sortObjectKeysDeep(data);
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

function sortObjectKeysDeep(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b, "en"))) {
    sorted[key] = sortObjectKeysDeep(value[key]);
  }
  return sorted;
}

/** @param {Record<string, unknown>} obj */
function flattenLeaves(obj, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenLeaves(value, dotPath));
    } else if (typeof value === "string") {
      out[dotPath] = value;
    } else if (value != null) {
      out[dotPath] = String(value);
    }
  }
  return out;
}

function setByPath(root, dotPath, value) {
  const parts = dotPath.split(".");
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!node[part] || typeof node[part] !== "object" || Array.isArray(node[part])) {
      node[part] = {};
    }
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

function deepMergePreserveExisting(target, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return target;
  }
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    if (!(key in target) || target[key] === undefined) {
      if (sourceVal !== null && typeof sourceVal === "object" && !Array.isArray(sourceVal)) {
        target[key] = {};
        deepMergePreserveExisting(target[key], sourceVal);
      } else {
        target[key] = sourceVal;
      }
      continue;
    }
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      deepMergePreserveExisting(targetVal, sourceVal);
    }
  }
  return target;
}

function isEmptyTranslation(value) {
  return typeof value !== "string" || value.trim() === "";
}

function collectMissing(sourceFlat, targetFlat) {
  /** @type {Record<string, string>} */
  const missing = {};
  for (const [dotPath, sourceText] of Object.entries(sourceFlat)) {
    const existing = targetFlat[dotPath];
    if (existing === undefined || isEmptyTranslation(existing)) {
      missing[dotPath] = sourceText;
    }
  }
  return missing;
}

function chunkEntries(obj, size) {
  const entries = Object.entries(obj);
  const chunks = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return chunks;
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Claude response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

async function translateBatch({ apiKey, targetLocale, batch }) {
  const targetLanguage = LOCALE_LABELS[targetLocale] || targetLocale;
  const userPrompt = `Target language: ${targetLanguage} (locale code: ${targetLocale})

Translate each string value in this JSON object. Keep keys unchanged.

${JSON.stringify(batch, null, 2)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 500)}`);
  }

  const payload = await response.json();
  const textBlock = payload.content?.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("Anthropic API returned no text content");
  }

  const parsed = extractJsonObject(textBlock.text);
  for (const key of Object.keys(batch)) {
    if (!(key in parsed)) {
      throw new Error(`Missing key in Claude translation batch: ${key}`);
    }
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  loadEnvFiles();

  if (!ALL_LOCALES.includes(opts.source)) {
    console.error(`Unknown source locale "${opts.source}". Supported: ${ALL_LOCALES.join(", ")}`);
    process.exit(1);
  }

  const { filePath: sourcePath, data: sourceData } = readLocaleFile(opts.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceFlat = flattenLeaves(sourceData);
  const targets = opts.lang ? [opts.lang] : ALL_LOCALES.filter((l) => l !== opts.source);

  if (opts.sortOnly) {
    for (const locale of ALL_LOCALES) {
      const { filePath, data } = readLocaleFile(locale);
      writeLocaleFile(filePath, data);
      console.log(`sorted ${locale}/${LOCALE_FILE}`);
    }
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  let totalMissing = 0;
  let totalFilled = 0;

  for (const locale of targets) {
    if (!ALL_LOCALES.includes(locale)) {
      console.error(`Unknown target locale "${locale}"`);
      process.exit(1);
    }

    const { filePath, data: localeData } = readLocaleFile(locale);
    deepMergePreserveExisting(localeData, sourceData);
    const localeFlat = flattenLeaves(localeData);
    let missing = collectMissing(sourceFlat, localeFlat);

    const missingCount = Object.keys(missing).length;
    totalMissing += missingCount;

    if (missingCount === 0) {
      writeLocaleFile(filePath, localeData);
      console.log(`[${locale}] in sync (${Object.keys(localeFlat).length} keys)`);
      continue;
    }

    console.log(`[${locale}] ${missingCount} missing/empty keys`);

    if (opts.dryRun) {
      const sample = Object.keys(missing).slice(0, 5);
      if (sample.length) console.log(`  sample: ${sample.join(", ")}`);
      writeLocaleFile(filePath, localeData);
      continue;
    }

    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not set. Use --dry-run or add the key to apps/api/.env");
      process.exit(1);
    }

    const keysToFill = Object.keys(missing).slice(0, opts.maxKeys);
    if (keysToFill.length < Object.keys(missing).length) {
      missing = Object.fromEntries(keysToFill.map((k) => [k, missing[k]]));
    }

    const batches = chunkEntries(missing, BATCH_SIZE);
    let filled = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      process.stdout.write(`  batch ${i + 1}/${batches.length} (${Object.keys(batch).length} keys)... `);
      const translated = await translateBatch({ apiKey, targetLocale: locale, batch });
      for (const [dotPath, value] of Object.entries(translated)) {
        if (typeof value !== "string") continue;
        setByPath(localeData, dotPath, value);
        filled += 1;
      }
      console.log("ok");
      if (i < batches.length - 1) await sleep(400);
    }

    writeLocaleFile(filePath, localeData);
    totalFilled += filled;
    console.log(`[${locale}] wrote ${filled} translations → ${filePath}`);
  }

  // Always re-sort source locale too
  writeLocaleFile(sourcePath, sourceData);
  console.log(`sorted source ${opts.source}/${LOCALE_FILE}`);

  console.log("\nSummary:");
  console.log(`  source: ${opts.source} (${Object.keys(sourceFlat).length} leaf keys)`);
  console.log(`  missing detected: ${totalMissing}`);
  console.log(`  filled via Claude: ${totalFilled}`);
  if (opts.dryRun) {
    console.log("  (dry-run — no API calls)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
