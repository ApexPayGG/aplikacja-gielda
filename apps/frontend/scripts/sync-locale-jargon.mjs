/**
 * For each non-PL locale: fill missing i18n keys from en, then apply jargon policy:
 * - Shared English / industry strings from en (never from pl — avoids Polish leaking into hi/de/…)
 * - regimeDetail / signalType / transport / copilotAction / confidenceCue / marketRegime from en
 * - Scalar paths below: English jargon from en (never pl). Paths that must stay
 *   locale-specific (e.g. hi regime/liveEngine/copilot title & enter) are omitted so
 *   translators are not overwritten on each run.
 *
 * Run from repo: node apps/frontend/scripts/sync-locale-jargon.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "public", "locales");

function deepMergeMissing(target, source) {
  if (source === null || typeof source !== "object" || Array.isArray(source)) return target;
  for (const k of Object.keys(source)) {
    if (!(k in target)) {
      target[k] = JSON.parse(JSON.stringify(source[k]));
    } else if (
      source[k] !== null &&
      typeof source[k] === "object" &&
      !Array.isArray(source[k]) &&
      target[k] !== null &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k])
    ) {
      deepMergeMissing(target[k], source[k]);
    }
  }
  return target;
}

function setPath(root, keys, value) {
  let o = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!o[k] || typeof o[k] !== "object") o[k] = {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}

function getPath(root, keys) {
  let o = root;
  for (const k of keys) {
    if (o == null || typeof o !== "object" || !(k in o)) return undefined;
    o = o[k];
  }
  return o;
}

/** Remove keys from `node` that are not in `enNode` (same shape as English source). */
function pruneToEnShape(node, enNode) {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  if (enNode === null || typeof enNode !== "object" || Array.isArray(enNode)) return;
  for (const k of Object.keys(node)) {
    if (!(k in enNode)) {
      delete node[k];
    } else if (
      node[k] !== null &&
      typeof node[k] === "object" &&
      !Array.isArray(node[k]) &&
      enNode[k] !== null &&
      typeof enNode[k] === "object" &&
      !Array.isArray(enNode[k])
    ) {
      pruneToEnShape(node[k], enNode[k]);
    }
  }
}

const enSubtrees = [
  ["signals", "regimeDetail"],
  ["signals", "signalType"],
  ["signals", "transport"],
  ["signals", "copilotAction"],
  ["signals", "confidenceCue"],
  ["signals", "marketRegime"],
  ["skilltree", "skills"],
];

const scalarPaths = [
  ["nav", "mirrorTrading"],
  ["nav", "alphaCalendar"],
  ["nav", "skillTree"],
  ["nav", "volatility"],
  ["nav", "crowdWisdom"],
  ["signals", "winRate"],
  ["signals", "stopLoss"],
  ["signals", "takeProfit"],
  ["signals", "dna"],
  ["signals", "entry"],
  ["signals", "aiBreif"],
  ["signals", "copilot", "conviction"],
  ["signals", "copilot", "invalidation"],
  ["signals", "copilot", "checkpoint"],
  ["signals", "trackRecordTitle"],
  ["signals", "trackWinRate"],
  ["signals", "trackMaxDd"],
  ["signals", "executionEntry"],
  ["signals", "executionStop"],
  ["signals", "executionTarget"],
  ["signals", "executionRr"],
  ["signals", "executionExpectedValue"],
  ["signals", "executionWorstCase"],
  ["paperTrading", "title"],
  ["paperTrading", "pnl"],
  ["paperTrading", "long"],
  ["paperTrading", "short"],
  ["mirror", "title"],
  ["mirror", "winRate"],
  ["mirror", "settingsTitle"],
  ["backtest", "title"],
  ["backtest", "runButton"],
  ["backtest", "winRate"],
  ["backtest", "maxDrawdown"],
  ["backtest", "sharpeRatio"],
  ["replay", "title"],
  ["reversescreener", "title"],
  ["trackrecord", "title"],
  ["trackrecord", "generateButton"],
  ["trackrecord", "cardTitle"],
  ["trackrecord", "winRate"],
  ["digest", "title"],
  ["strategydna", "title"],
  ["strategydna", "insightLabel"],
  ["earnings", "title"],
  ["insider", "title"],
  ["insider", "insight"],
  ["discord", "title"],
  ["crowdwisdom", "title"],
  ["correlation", "title"],
  ["correlation", "aiInsight"],
  ["skilltree", "title"],
  ["volatility", "title"],
  ["newshalflife", "title"],
  ["newshalflife", "expired"],
  ["psyche", "dnaTitle"],
  ["psyche", "topBiases"],
  ["coach", "overtrading"],
  ["coach", "chartAvgWin"],
  ["coach", "chartAvgLoss"],
  ["alpha", "title"],
  ["positionSize", "stop"],
  ["premortem", "stopLoss"],
  ["premortem", "takeProfit"],
];

/**
 * Keep landing copy in each locale in sync with EN key shape:
 * - Add missing keys automatically
 * - Preserve existing translated values
 */
function mergeLandingMissing(localeData, enData) {
  if (!localeData || typeof localeData !== "object") return;
  if (!enData || typeof enData !== "object") return;
  const localeLanding = localeData.landing;
  const enLanding = enData.landing;
  if (!enLanding || typeof enLanding !== "object") return;
  if (!localeLanding || typeof localeLanding !== "object") {
    localeData.landing = JSON.parse(JSON.stringify(enLanding));
    return;
  }
  deepMergeMissing(localeData.landing, enLanding);
}

const langs = ["de", "es", "fr", "hi", "ja", "ko", "zh-TW"];

const enSource = JSON.parse(fs.readFileSync(path.join(localesDir, "en", "common.json"), "utf8"));

for (const lng of langs) {
  const filePath = path.join(localesDir, lng, "common.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  deepMergeMissing(data, enSource);
  mergeLandingMissing(data, enSource);
  if (data.signals && enSource.signals) {
    pruneToEnShape(data.signals, enSource.signals);
  }

  for (const sub of enSubtrees) {
    const v = getPath(enSource, sub);
    if (v !== undefined) {
      setPath(data, sub, JSON.parse(JSON.stringify(v)));
    }
  }

  for (const pk of scalarPaths) {
    const v = getPath(enSource, pk);
    if (v !== undefined) {
      setPath(data, pk, v);
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("updated", lng);
}
