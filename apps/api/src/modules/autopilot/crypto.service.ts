import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;
const KEY_BYTE_LENGTH = 32;
const KEY_HEX_LENGTH = KEY_BYTE_LENGTH * 2;

function loadEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET?.trim();
  if (!secret || !/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error(
      "ENCRYPTION_SECRET must be a 64-character hex string encoding exactly 32 bytes",
    );
  }
  return Buffer.from(secret, "hex");
}

export class AutopilotCryptoService {
  encrypt(text: string): string {
    const key = loadEncryptionKey();
    const iv = randomBytes(IV_BYTE_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(encryptedData: string): string {
    const key = loadEncryptionKey();
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted payload format — expected iv:authTag:ciphertext");
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    if (!ivHex?.length || !authTagHex?.length || !ciphertextHex?.length) {
      throw new Error("Invalid encrypted payload — empty segment");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  }
}

export const autopilotCryptoService = new AutopilotCryptoService();
