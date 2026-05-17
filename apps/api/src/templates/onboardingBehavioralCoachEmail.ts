function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generateOnboardingBehavioralCoachEmail(name?: string | null): string {
  const safeName = name?.trim() ? escapeHtml(name.trim()) : null;
  const greeting = safeName ? `Cześć ${safeName},` : "Cześć,";
  const coachUrl = "https://stock-ai.pro/app/behavioral";

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Behavioral Coach — StockAI Pro</title>
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
                <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;">Czy wiesz że StockAI Pro ma Behavioral Coach?</h1>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#374151;">
                  ${greeting} Behavioral Coach analizuje Twoje decyzje i pomaga wyłapać powtarzalne błędy (np. overtrading, FOMO, zbyt szybkie zamykanie pozycji).
                </p>
                <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#374151;">
                  Dzięki temu otrzymujesz konkretne wskazówki, jak poprawić proces decyzyjny jeszcze zanim kosztowne nawyki utrwalą się w portfelu.
                </p>
                <div style="margin:0 0 24px 0;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;text-align:center;">
                  <img
                    src="https://stock-ai.pro/assets/email/behavioral-coach-placeholder.png"
                    alt="Podgląd Behavioral Coach - placeholder screenshot"
                    style="width:100%;max-width:520px;height:auto;border-radius:8px;border:1px solid #d1d5db;"
                  />
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D0A6B;">
                      <a href="${coachUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:10px;">
                        Wypróbuj Behavioral Coach
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
