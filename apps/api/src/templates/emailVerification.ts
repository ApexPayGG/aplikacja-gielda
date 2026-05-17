function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generateVerificationEmail(token: string, email: string): string {
  const verifyUrl = `https://stock-ai.pro/verify?token=${encodeURIComponent(token)}`;
  const safeEmail = escapeHtml(email);

  return `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Potwierdź swój email</title>
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
                <h1 style="margin:0 0 14px 0;font-size:28px;line-height:1.2;">Potwierdź swój email</h1>
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#374151;">
                  Dziękujemy za rejestrację w StockAI Pro. Kliknij przycisk poniżej, aby aktywować konto dla adresu <strong>${safeEmail}</strong>.
                </p>
                <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#6b7280;">
                  Link aktywacyjny jest ważny przez 24 godziny.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D0A6B;">
                      <a href="${verifyUrl}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:10px;">
                        Potwierdź email
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;word-break:break-all;">
                  Jeśli przycisk nie działa, skopiuj ten link:
                  <a href="${verifyUrl}" style="color:#2D0A6B;">${verifyUrl}</a>
                </p>
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
