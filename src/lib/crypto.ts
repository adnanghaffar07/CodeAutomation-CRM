// AES-256-GCM encryption for integration credentials. The key is APP_ENCRYPTION_KEY (64 hex chars = 32 bytes),
// server-side only. Stored format: "v1.<iv>.<authTag>.<ciphertext>" (base64url). Losing the key means losing the secrets.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("APP_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)");
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "sk-live-abcd1234" -> "••••1234": enough to recognise a key without revealing it. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
