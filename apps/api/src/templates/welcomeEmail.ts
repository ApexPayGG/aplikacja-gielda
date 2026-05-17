function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generateWelcomeEmail(name?: string): string {
  const safeName = name?.trim() ? escapeHtml(name.trim()) : null;
  const greeting = safeName ? `Cześć ${safeName},` : "Cześć,";
  const dashboardUrl = "https://stock-ai.pro/app/dashboard";
  const watchlistUrl = "https://stock-ai.pro/app/watchlist";
  const paperTradingUrl = "https://stock-ai.pro/app/paper-trading";

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Witaj w StockAI Pro</title>
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
                <h1 style="margin:0 0 16px 0;font-size:30px;line-height:1.2;">Witaj w StockAI Pro!</h1>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#374151;">
                  ${greeting} Twoje konto jest aktywne. Zacznij od tych 3 kroków, aby szybko uruchomić StockAI Pro w praktyce.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td style="padding-bottom:14px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:30px;height:30px;border-radius:15px;background:#2D0A6B;color:#ffffff;text-align:center;font-weight:700;font-size:14px;">1</td>
                          <td style="padding-left:12px;font-size:15px;line-height:1.5;color:#374151;">
                            <a href="${dashboardUrl}" style="color:#2D0A6B;text-decoration:none;font-weight:600;">Otwórz Dashboard</a>
                            i zobacz kluczowe wskaźniki oraz aktywne sygnały.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:14px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:30px;height:30px;border-radius:15px;background:#2D0A6B;color:#ffffff;text-align:center;font-weight:700;font-size:14px;">2</td>
                          <td style="padding-left:12px;font-size:15px;line-height:1.5;color:#374151;">
                            Dodaj pierwsze spółki do
                            <a href="${watchlistUrl}" style="color:#2D0A6B;text-decoration:none;font-weight:600;">Watchlisty</a>,
                            aby śledzić sygnały i alerty.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:30px;height:30px;border-radius:15px;background:#2D0A6B;color:#ffffff;text-align:center;font-weight:700;font-size:14px;">3</td>
                          <td style="padding-left:12px;font-size:15px;line-height:1.5;color:#374151;">
                            Wykonaj pierwszy trade w
                            <a href="${paperTradingUrl}" style="color:#2D0A6B;text-decoration:none;font-weight:600;">Paper Trading</a>,
                            aby trenować strategię bez ryzyka.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D0A6B;">
                      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:10px;">
                        Przejdź do Dashboard
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
