/**
 * For each non-PL locale: fill missing i18n keys from en, then apply jargon policy:
 * - English labels shared with pl (Win rate, Signal DNA, Mirror Trading, …)
 * - regimeDetail / signalType / transport always from en (English UI copy)
 * - copilot badges, marketRegime badges from pl (matches en for PRIME / Risk-on, etc.)
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

const pl = JSON.parse(fs.readFileSync(path.join(localesDir, "pl", "common.json"), "utf8"));

const plSubtrees = [
  ["signals", "copilotAction"],
  ["signals", "narrativeConfidence"],
  ["signals", "confidenceCue"],
  ["signals", "marketRegime"],
];

const enSubtrees = [
  ["signals", "regimeDetail"],
  ["signals", "signalType"],
  ["signals", "transport"],
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
  ["signals", "copilot", "title"],
  ["signals", "copilot", "conviction"],
  ["signals", "copilot", "invalidation"],
  ["signals", "copilot", "invalidationBody"],
  ["signals", "copilot", "checkpoint"],
  ["signals", "copilot", "checkpointBody"],
  ["signals", "copilot", "enter"],
  ["signals", "regime", "title"],
  ["signals", "regime", "mode"],
  ["signals", "regime", "executionStyle"],
  ["signals", "regime", "riskCap"],
  ["signals", "liveEngine", "label"],
  ["signals", "liveEngine", "polling"],
  ["signals", "liveEngine", "sseUnavailable"],
  ["signals", "liveEngine", "lastUpdate"],
  ["signals", "liveEngine", "lastUpdateEmpty"],
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

const langs = ["de", "es", "fr", "hi", "ja", "ko", "zh-TW"];

for (const lng of langs) {
  const en = JSON.parse(fs.readFileSync(path.join(localesDir, "en", "common.json"), "utf8"));
  const filePath = path.join(localesDir, lng, "common.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  deepMergeMissing(data, en);
  if (data.signals && en.signals) {
    pruneToEnShape(data.signals, en.signals);
  }

  for (const sub of plSubtrees) {
    const v = getPath(pl, sub);
    if (v !== undefined) {
      setPath(data, sub, JSON.parse(JSON.stringify(v)));
    }
  }

  for (const sub of enSubtrees) {
    const v = getPath(en, sub);
    if (v !== undefined) {
      setPath(data, sub, JSON.parse(JSON.stringify(v)));
    }
  }

  for (const pk of scalarPaths) {
    const v = getPath(pl, pk);
    if (v !== undefined) {
      setPath(data, pk, v);
    }
  }

  if (pl.volatility?.tooltip && data.volatility) {
    data.volatility.tooltip = JSON.parse(JSON.stringify(pl.volatility.tooltip));
  }

  const sm = data.skilltree?.skills;
  const pm = pl.skilltree?.skills;
  if (sm && pm) {
    if (pm.SUPPORT_RESISTANCE?.name) {
      sm.SUPPORT_RESISTANCE ??= {};
      sm.SUPPORT_RESISTANCE.name = pm.SUPPORT_RESISTANCE.name;
    }
    if (pm.RISK_MANAGEMENT?.name) {
      sm.RISK_MANAGEMENT ??= {};
      sm.RISK_MANAGEMENT.name = pm.RISK_MANAGEMENT.name;
    }
    if (pm.RISK_MANAGEMENT?.condition) {
      sm.RISK_MANAGEMENT ??= {};
      sm.RISK_MANAGEMENT.condition = pm.RISK_MANAGEMENT.condition;
    }
    if (pm.STRATEGY?.condition) {
      sm.STRATEGY ??= {};
      sm.STRATEGY.condition = pm.STRATEGY.condition;
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log("updated", lng);
}
