import pino from "pino";

interface DividendRadarInput {
  top_dividends: Array<{
    ticker: string;
    dy: number;
    payout_ratio: number;
    health_score: number;
    brief: string;
  }>;
  new_opportunities: Array<{
    ticker: string;
    pattern: string;
    score: number;
  }>;
  upcoming_ex_dates: Array<{
    ticker: string;
    ex_date: string;
    amount: number;
  }>;
}

type FetchResponse = { ok: boolean; status: number; text: () => Promise<string> };
type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

function isoWeekAndYear(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { week, year: date.getUTCFullYear() };
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHtml(data: DividendRadarInput): string {
  const top = data.top_dividends
    .slice()
    .sort((a, b) => b.health_score - a.health_score)
    .slice(0, 5)
    .map(
      (d) =>
        `<li><b>${escapeHtml(d.ticker)}</b> — DY ${d.dy}% | payout ${d.payout_ratio}% | health ${d.health_score}<br/>${escapeHtml(
          d.brief,
        )}</li>`,
    )
    .join("");

  const opps = data.new_opportunities
    .map(
      (o) => `<li><b>${escapeHtml(o.ticker)}</b> — ${escapeHtml(o.pattern)} | score ${o.score}</li>`,
    )
    .join("");

  const exDates = data.upcoming_ex_dates
    .map(
      (e) => `<li><b>${escapeHtml(e.ticker)}</b> — ex-date ${escapeHtml(e.ex_date)} | amount ${e.amount}</li>`,
    )
    .join("");

  const ctaUrl = process.env.STOCKAI_PLATFORM_URL ?? "https://stockai.pro";

  return `
<html>
  <body style="font-family:Arial,sans-serif;line-height:1.5;">
    <h2>Dywidendowy Radar</h2>
    <h3>Top 5 dividend stocks</h3>
    <ul>${top || "<li>Brak danych</li>"}</ul>
    <h3>New opportunities</h3>
    <ul>${opps || "<li>Brak nowych okazji</li>"}</ul>
    <h3>Upcoming ex-dates (next 14 days)</h3>
    <ul>${exDates || "<li>Brak nadchodzących ex-date</li>"}</ul>
    <p><a href="${escapeHtml(ctaUrl)}">View in StockAI Pro</a></p>
  </body>
</html>
`.trim();
}

export class NewsletterService {
  private readonly apiKey: string;

  private readonly fetchFn: FetchLike;

  private readonly logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { scope: "newsletter_service" },
  });

  constructor(resendApiKey: string) {
    const key = resendApiKey?.trim();
    if (!key) throw new Error("Resend API key is required");
    this.apiKey = key;
    this.fetchFn = (globalThis.fetch as unknown) as FetchLike;
  }

  async sendDividendRadar(recipients: string[], data: DividendRadarInput): Promise<void> {
    const uniqueRecipients = [...new Set(recipients.map((r) => r.trim()).filter(Boolean))];
    if (uniqueRecipients.length === 0) return;

    const { week, year } = isoWeekAndYear(new Date());
    const subject = `Dywidendowy Radar — Tydzień ${week}/${year}`;
    const html = buildHtml(data);

    const payload = {
      from: process.env.NEWSLETTER_FROM ?? "StockAI Pro <newsletter@stockai.pro>",
      to: uniqueRecipients,
      subject,
      html,
    };

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.fetchFn("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend API ${res.status}: ${body}`);
        }
        this.logger.info({
          msg: "newsletter_sent",
          recipients: uniqueRecipients.length,
          week,
          year,
        });
        return;
      } catch (error) {
        lastErr = error;
        this.logger.error({
          msg: "newsletter_send_failed",
          attempt,
          err: error instanceof Error ? error.message : String(error),
        });
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
