function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type WeekOneInput = {
  name?: string | null;
  tier?: string | null;
};

export function generateOnboardingWeekOneEmail(input: WeekOneInput): string {
  const safeName = input.name?.trim() ? escapeHtml(input.name.trim()) : null;
  const greeting = safeName ? `Cześć ${safeName},` : "Cześć,";
  const tier = String(input.tier ?? "FREE").trim().toUpperCase();
  const isFree = tier === "FREE";
  const dashboardUrl = "https://stock-ai.pro/app/dashboard";
  const pricingUrl = "https://stock-ai.pro/pricing";

  const upgradeBlock = isFree
    ? `
      <tr>
        <td style="padding-top:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius:10px;background-color:#111827;">
                <a href="${pricingUrl}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:10px;">
                  Odblokuj StockAI Pro
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
    : "";

  const primaryCtaLabel = isFree ? "Przejdź na plan Pro" : "Przejdź do Dashboard";
  const primaryCtaUrl = isFree ? pricingUrl : dashboardUrl;

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Twoje pierwsze 7 dni — co dalej?</title>
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
                <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;">Twoje pierwsze 7 dni — co dalej?</h1>
                <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#374151;">
                  ${greeting} czas przejść na kolejny poziom pracy ze StockAI Pro.
                </p>
                <ul style="margin:0 0 20px 18px;padding:0;color:#374151;font-size:15px;line-height:1.7;">
                  <li>Dashboard: szybki przegląd sygnałów i aktywności portfela.</li>
                  <li>Behavioral Coach: feedback nawyków i decyzji inwestycyjnych.</li>
                  <li>Alerty + digest: stały monitoring rynku bez przeciążenia informacyjnego.</li>
                </ul>
                <div style="margin:0 0 22px 0;padding:14px;border-left:4px solid #2D0A6B;background:#f9fafb;color:#111827;font-size:15px;line-height:1.6;">
                  <strong>Tip:</strong> regularnie prowadź Paper Trading, aby testować setupy i zarządzanie ryzykiem bez presji realnego kapitału.
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D0A6B;">
                      <a href="${primaryCtaUrl}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:10px;">
                        ${primaryCtaLabel}
                      </a>
                    </td>
                  </tr>
                  ${upgradeBlock}
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
