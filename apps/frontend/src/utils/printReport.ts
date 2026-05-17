import { formatCurrency, formatDate, formatNumber, formatPercent } from "./formatters";

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tableRows(trades: PrintableTrade[]): string {
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
          <td>${formatDate(trade.entryAt, "pl-PL")}</td>
          <td>${formatDate(trade.exitAt, "pl-PL")}</td>
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

export function printPortfolioReport(trades: PrintableTrade[], stats: PrintableStats): void {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!printWindow) return;

  const printedAt = formatDate(new Date(), "pl-PL");
  const reportDate = new Date().toLocaleDateString("pl-PL");

  printWindow.document.write(`
    <!doctype html>
    <html lang="pl">
      <head>
        <meta charset="utf-8" />
        <title>StockAI Pro — Raport portfela ${reportDate}</title>
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
        <h1>StockAI Pro — Raport portfela ${reportDate}</h1>
        <div class="meta">Wygenerowano: ${printedAt}</div>

        <h2>Trades</h2>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Kierunek</th>
              <th>Status</th>
              <th>Ilość</th>
              <th>Entry</th>
              <th>Exit / Current</th>
              <th>P&amp;L</th>
              <th>P&amp;L %</th>
              <th>Entry at</th>
              <th>Exit at</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows(trades)}
          </tbody>
        </table>

        <h2>Summary</h2>
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
