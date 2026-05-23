import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AutopilotCryptoService } from "./crypto.service";

const VALID_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("AutopilotCryptoService", () => {
  let oldSecret: string | undefined;

  beforeEach(() => {
    oldSecret = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (oldSecret === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = oldSecret;
    }
  });

  it("encrypt/decrypt round-trip preserves plaintext", () => {
    const crypto = new AutopilotCryptoService();
    const plainText = "PKTEST1234567890";
    const encrypted = crypto.encrypt(plainText);
    assert.notEqual(encrypted, plainText);
    assert.equal(crypto.decrypt(encrypted), plainText);
  });

  it("encrypted payload does not contain plaintext", () => {
    const crypto = new AutopilotCryptoService();
    const plainText = "secret-alpaca-key-value";
    const encrypted = crypto.encrypt(plainText);
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    assert.ok(!encrypted.includes(plainText));
  });

  it("throws when ENCRYPTION_SECRET is invalid", () => {
    process.env.ENCRYPTION_SECRET = "too-short";
    const crypto = new AutopilotCryptoService();
    assert.throws(
      () => crypto.encrypt("value"),
      /ENCRYPTION_SECRET must be a 64-character hex string/,
    );
  });
});
