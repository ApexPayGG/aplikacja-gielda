#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "Dashboard.tsx");
let src = fs.readFileSync(file, "utf8");

if (!src.includes("DashboardWelcomeHero")) {
  src = src.replace(
    'import { DailyCheckInWidget } from "../components/DailyCheckInWidget";',
    'import { DailyCheckInWidget } from "../components/DailyCheckInWidget";\nimport { DashboardWelcomeHero } from "../components/DashboardWelcomeHero";',
  );
}

src = src.replace(
  `  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return "Trader";
    return raw.split(/\\s+/)[0];
  }, [user?.name]);`,
  `  const firstName = useMemo(() => {
    const raw = user?.name?.trim();
    if (!raw) return null;
    return raw.split(/\\s+/)[0];
  }, [user?.name]);

  const isEmptyDashboard = !watchlistLoading && !watchlistError && watchlistRows.length === 0;
  const hasWatchlistMetrics = quickStats.watchlistCount > 0;
  const noDataLabel = t("dashboard.statNoData", { defaultValue: "—" });`,
);

src = src.replace(
  `      value: String(quickStats.signalCount),
      trend: quickStats.signalCount > 0 ? "up" : "flat",`,
  `      value: hasWatchlistMetrics ? String(quickStats.signalCount) : noDataLabel,
      trend: hasWatchlistMetrics && quickStats.signalCount > 0 ? "up" : "flat",`,
);

src = src.replace(
  `      value: String(quickStats.watchlistCount),
      trend: quickStats.watchlistCount > 0 ? "up" : "flat",`,
  `      value: hasWatchlistMetrics ? String(quickStats.watchlistCount) : noDataLabel,
      trend: hasWatchlistMetrics && quickStats.watchlistCount > 0 ? "up" : "flat",`,
);

src = src.replace(
  `      value: \`\${formatNumber(quickStats.winRate, 1)}%\`,
      trend: quickStats.winRate >= 50 ? "up" : "down",`,
  `      value: hasWatchlistMetrics ? \`\${formatNumber(quickStats.winRate, 1)}%\` : noDataLabel,
      trend: !hasWatchlistMetrics ? "flat" : quickStats.winRate >= 50 ? "up" : "down",`,
);

src = src.replace(
  `      value: String(quickStats.streak),
      trend: quickStats.streak > 0 ? "up" : "down",`,
  `      value: hasWatchlistMetrics ? String(quickStats.streak) : noDataLabel,
      trend: !hasWatchlistMetrics ? "flat" : quickStats.streak > 0 ? "up" : "flat",`,
);

const trendIdx = src.indexOf("  function trendIcon(tone: TrendTone) {");
if (trendIdx === -1) throw new Error("trendIcon not found");
const returnIdx = src.indexOf("  return (", trendIdx);
const closeIdx = src.indexOf("      <InvestmentDisclaimer", returnIdx);
const endIdx = src.indexOf("  );", closeIdx);
if (returnIdx === -1 || closeIdx === -1 || endIdx === -1) throw new Error("return block bounds not found");

const jsx = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "dashboard-return.jsx.txt"),
  "utf8",
);

src = src.slice(0, returnIdx) + jsx.trimEnd() + src.slice(endIdx + 4);
fs.writeFileSync(file, src);
console.log("Patched Dashboard.tsx");
