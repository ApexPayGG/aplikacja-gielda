import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateVerificationEmail } from "../emailVerification";
import { generateOnboardingBehavioralCoachEmail } from "../onboardingBehavioralCoachEmail";
import { generateOnboardingWeekOneEmail } from "../onboardingWeekOneEmail";
import { generatePasswordResetEmail } from "../passwordResetEmail";
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

  it("builds password reset email with token link, recipient email and reset CTA", () => {
    const html = generatePasswordResetEmail("token-123", "jan@example.com");

    assert.match(html, /https:\/\/stock-ai\.pro\/reset-password\?token=token-123/);
    assert.match(html, /jan@example\.com/);
    assert.match(html, /Resetuj hasło/);
  });

  it("builds welcome email with 3 quick start steps and CTA", () => {
    const html = generateWelcomeEmail("Jan");

    assert.match(html, /Witaj w StockAI Pro!/);
    assert.match(html, />1</);
    assert.match(html, />2</);
    assert.match(html, />3</);
    assert.match(html, /Przejdź do Dashboard/);
    assert.match(html, /https:\/\/stock-ai\.pro\/app\/dashboard/);
    assert.match(html, /https:\/\/stock-ai\.pro\/app\/watchlist/);
    assert.match(html, /https:\/\/stock-ai\.pro\/app\/paper-trading/);
    assert.match(html, /Jan/);
  });

  it("builds onboarding email 2 with behavioral coach explanation and screenshot placeholder", () => {
    const html = generateOnboardingBehavioralCoachEmail("Jan");

    assert.match(html, /Behavioral Coach/);
    assert.match(html, /alt="Podgląd Behavioral Coach - placeholder screenshot"/);
    assert.match(html, /Wypróbuj Behavioral Coach/);
    assert.match(html, /Jan/);
  });

  it("builds onboarding email 3 with paper trading tip and upgrade CTA for FREE users", () => {
    const freeHtml = generateOnboardingWeekOneEmail({ name: "Jan", tier: "FREE" });
    const proHtml = generateOnboardingWeekOneEmail({ name: "Jan", tier: "PRO" });

    assert.match(freeHtml, /Twoje pierwsze 7 dni/);
    assert.match(freeHtml, /Paper Trading/);
    assert.match(freeHtml, /Odblokuj StockAI Pro/);
    assert.doesNotMatch(proHtml, /Odblokuj StockAI Pro/);
  });
});
