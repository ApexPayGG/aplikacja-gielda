import { formatCurrency, formatDate, formatNumber, formatPercent, resolveIntlLocale } from "./formatters";

type PrintableTrade = {
  ticker: string;
  direction?: string;
  status?: string;
  quantity?: number;
  entryPrice?: number;
  exitPrice?: number;
  currentPrice?: number;
  pnl?: number;
  pnlPct?: number;
  entryAt?: string;
  exitAt?: string;
};

type PrintableStats = Record<string, string | number>;

export type PrintReportLabels = {
  title: string;
  generatedAt: string;
  tradesHeading: string;
  summaryHeading: string;
  colSymbol: string;
  colDirection: string;
  colStatus: string;
  colQuantity: string;
  colEntry: string;
  colExitCurrent: string;
  colPnl: string;
  colPnlPct: string;
  colEntryAt: string;
  colExitAt: string;
};

const DEFAULT_LABELS: PrintReportLabels = {
  title: "StockAI Pro — Portfolio report",
  generatedAt: "Generated",
  tradesHeading: "Trades",
  summaryHeading: "Summary",
  colSymbol: "Symbol",
  colDirection: "Direction",
  colStatus: "Status",
  colQuantity: "Quantity",
  colEntry: "Entry",
  colExitCurrent: "Exit / Current",
  colPnl: "P&L",
  colPnlPct: "P&L %",
  colEntryAt: "Entry at",
  colExitAt: "Exit at",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tableRows(trades: PrintableTrade[], locale: string): string {
  return trades
    .map((trade) => {
      const priceDisplay = trade.exitPrice ?? trade.currentPrice;
      return `
        <tr>
          <td>${escapeHtml(trade.ticker ?? "—")}</td>
          <td>${escapeHtml(trade.direction ?? "—")}</td>
          <td>${escapeHtml(trade.status ?? "—")}</td>
          <td>${formatNumber(trade.quantity ?? 0, 2)}</td>
          <td>${formatCurrency(trade.entryPrice ?? 0, "USD")}</td>
          <td>${formatCurrency(priceDisplay ?? 0, "USD")}</td>
          <td class="${(trade.pnl ?? 0) >= 0 ? "positive" : "negative"}">${formatCurrency(trade.pnl ?? 0, "USD")}</td>
          <td class="${(trade.pnlPct ?? 0) >= 0 ? "positive" : "negative"}">${formatPercent(trade.pnlPct ?? 0)}</td>
          <td>${formatDate(trade.entryAt, locale)}</td>
          <td>${formatDate(trade.exitAt, locale)}</td>
        </tr>
      `;
    })
    .join("");
}

function statsRows(stats: PrintableStats): string {
  return Object.entries(stats)
    .map(([label, value]) => {
      const text = typeof value === "number" ? formatNumber(value, 2) : value;
      return `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(text)}</td>
        </tr>
      `;
    })
    .join("");
}

export function printPortfolioReport(
  trades: PrintableTrade[],
  stats: PrintableStats,
  options?: { locale?: string; labels?: Partial<PrintReportLabels> },
): void {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!printWindow) return;

  const locale = resolveIntlLocale(options?.locale ?? "en");
  const labels = { ...DEFAULT_LABELS, ...options?.labels };
  const printedAt = formatDate(new Date(), locale);
  const reportDate = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const htmlLang = locale.startsWith("pl") ? "pl" : "en";

  printWindow.document.write(`
    <!doctype html>
    <html lang="${htmlLang}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(labels.title)} ${reportDate}</title>
        <style>
          body { margin: 24px; font-family: Arial, sans-serif; background: #fff; color: #111; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .meta { margin-bottom: 18px; color: #333; font-size: 13px; }
          h2 { margin: 20px 0 10px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #111; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f2f2f2; }
          .positive { color: #0f7a3a; font-weight: 700; }
          .negative { color: #b42318; font-weight: 700; }
          footer { margin-top: 28px; font-size: 12px; color: #444; }
          @media print {
            body { margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(labels.title)} ${reportDate}</h1>
        <div class="meta">${escapeHtml(labels.generatedAt)}: ${printedAt}</div>

        <h2>${escapeHtml(labels.tradesHeading)}</h2>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(labels.colSymbol)}</th>
              <th>${escapeHtml(labels.colDirection)}</th>
              <th>${escapeHtml(labels.colStatus)}</th>
              <th>${escapeHtml(labels.colQuantity)}</th>
              <th>${escapeHtml(labels.colEntry)}</th>
              <th>${escapeHtml(labels.colExitCurrent)}</th>
              <th>${escapeHtml(labels.colPnl)}</th>
              <th>${escapeHtml(labels.colPnlPct)}</th>
              <th>${escapeHtml(labels.colEntryAt)}</th>
              <th>${escapeHtml(labels.colExitAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows(trades, locale)}
          </tbody>
        </table>

        <h2>${escapeHtml(labels.summaryHeading)}</h2>
        <table>
          <tbody>
            ${statsRows(stats)}
          </tbody>
        </table>

        <footer>stock-ai.pro</footer>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
