import fs from "fs";
import path from "path";
import os from "os";

const root = path.join(os.homedir(), "Desktop", "Aplikacja Giełda");
const public3d = path.join(root, "apps", "frontend", "public", "icons3d");

const sourceFolders = {
  "finance business": "Icona Studio - finance business",
  "technology digital": "Iconora Studio - Premium - technology_digital - blue_glass",
  "ecommerce retail": "Iconora Studio - Premium - ecommerce_retail - blue_glass",
  "ui system": "Iconora Studio - Premium - ui_system - blue_glass",
  "social communication": "Iconora Studio - Premium - social_communication - blue_glass",
};

const picks = {
  "finance business": [
    "Stock Trading - blue_glass - Stock ticker chart with dollar symbol.png",
    "Bank Building - blue_glass - classical bank facade.png",
    "Financial Chart - blue_glass - financial chart.png",
    "Credit Card - blue_glass - Credit Card.png",
  ],
  "technology digital": [
    "performance dashboard - blue_glass - screen with multiple performance gauges.png",
    "cloud storage - blue_glass - cloud with upload arrow.png",
    "Trading Chart - blue_glass - graph with rising line.png",
    "AI Analytics - blue_glass - brain with circuit lines.png",
  ],
  "ecommerce retail": [
    "shopping cart - blue_glass - shopping cart with products.png",
    "add to cart button - blue_glass - shopping cart with plus symbol.png",
    "best sellers - blue_glass - cardboard box with gold medal.png",
    "online payment - blue_glass - smartphone with credit card.png",
  ],
  "ui system": [
    "dashboard - blue_glass - dashboard with widgets.png",
    "settings gear - blue_glass - gear with small wrench.png",
    "analytics chart - blue_glass - bar chart with trend line.png",
    "notification bell - blue_glass - bell with alert dot.png",
  ],
  "social communication": [
    "live support - blue_glass - headset agent on communication panel.png",
    "support chat bubble - blue_glass - overlapping speech bubbles with headset.png",
    "team chat - blue_glass - group chat bubbles.png",
    "public forum global - blue_glass - globe with multiple user avatars.png",
  ],
};

function walkPng(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPng(full));
    else if (entry.name.endsWith(".png")) out.push(full);
  }
  return out;
}

function findFile(folderKey, needle) {
  const srcRoot = path.join(root, sourceFolders[folderKey]);
  const all = walkPng(srcRoot);
  const exact = all.find((p) => path.basename(p) === needle);
  if (exact) return exact;
  const partial = all.find((p) => path.basename(p).toLowerCase().includes(needle.toLowerCase().split(" - ")[0]));
  return partial ?? null;
}

for (const [folderKey, files] of Object.entries(picks)) {
  const destDir = path.join(public3d, folderKey);
  fs.mkdirSync(destDir, { recursive: true });
  files.forEach((needle, index) => {
    const src = findFile(folderKey, needle);
    const destName = `icon-${index + 1}.png`;
    if (!src) {
      console.warn("MISSING", folderKey, needle);
      return;
    }
    fs.copyFileSync(src, path.join(destDir, destName));
    console.log("ok", folderKey, destName, "<-", path.basename(src));
  });
}
