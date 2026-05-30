import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatePasswordResetEmail } from "../passwordResetEmail";

describe("passwordResetEmail template", () => {
  it("states reset link expires after 1 hour", () => {
    const html = generatePasswordResetEmail("test-token", "user@example.com");
    assert.match(html, /1 godzin/i);
    assert.doesNotMatch(html, /24 godzin/i);
  });
});
