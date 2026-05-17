import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateVerificationEmail } from "../emailVerification";
import { generateWelcomeEmail } from "../welcomeEmail";

describe("email templates", () => {
  it("builds verification email with branded layout and CTA", () => {
    const html = generateVerificationEmail("token-123", "jan@example.com");

    assert.match(html, /StockAI Pro/);
    assert.match(html, /#2D0A6B/);
    assert.match(html, /Potwierdź email/);
    assert.match(html, /max-width:\s*600px/i);
    assert.match(html, /© 2026 StockAI Pro/);
    assert.match(html, /https:\/\/stock-ai\.pro\/verify\?token=token-123/);
    assert.match(html, /jan@example\.com/);
  });

  it("builds welcome email with 3 quick start steps and CTA", () => {
    const html = generateWelcomeEmail("Jan");

    assert.match(html, /Witaj w StockAI Pro!/);
    assert.match(html, />1</);
    assert.match(html, />2</);
    assert.match(html, />3</);
    assert.match(html, /Przejdź do aplikacji/);
    assert.match(html, /Jan/);
  });
});
