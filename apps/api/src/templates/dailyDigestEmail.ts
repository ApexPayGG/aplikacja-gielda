function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function digestToHtmlParagraphs(digest: string): string {
  return escapeHtml(digest)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#374151;">${line}</p>`)
    .join("");
}

export function generateDailyDigestEmail(input: {
  digest: string;
  date: string;
  name?: string | null;
  lang?: string;
}): string {
  const safeName = input.name?.trim() ? escapeHtml(input.name.trim()) : null;
  const greeting = safeName ? `Cześć ${safeName},` : "Cześć,";
  const digestBody = digestToHtmlParagraphs(input.digest);
  const dateLabel = escapeHtml(input.date);
  const langAttr = escapeHtml(input.lang?.trim() || "pl");

  return `<!doctype html>
<html lang="${langAttr}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StockAI Pro — Daily Digest</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;">
            <tr>
              <td style="background-color:#2D0A6B;padding:24px;text-align:center;">
                <span style="display:inline-block;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.3px;">StockAI Pro</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff;padding:32px 28px;color:#111827;">
                <h1 style="margin:0 0 12px 0;font-size:30px;line-height:1.2;">Twój Daily Digest</h1>
                <p style="margin:0 0 8px 0;font-size:13px;line-height:1.4;color:#6b7280;">${dateLabel}</p>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#374151;">
                  ${greeting} poniżej znajdziesz dzienny przegląd rynku wygenerowany specjalnie dla Ciebie.
                </p>
                ${digestBody}
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D0A6B;">
                      <a href="https://stock-ai.pro/app/digest" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:10px;">
                        Otwórz Daily Digest
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:#e5e7eb;padding:16px;text-align:center;color:#6b7280;font-size:13px;">
                © 2026 StockAI Pro
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
