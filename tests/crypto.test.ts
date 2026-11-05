// Credentials are encrypted with AES-256-GCM: round trip, random IVs, tamper detection, and no plaintext in the output.
import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "../src/lib/crypto";

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
});

describe("secret encryption", () => {
  it("round-trips a secret", () => {
    const s = "sk_live_abcdef1234567890";
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });

  it("never contains the plaintext and differs every time", () => {
    const s = "sk_live_abcdef1234567890";
    const a = encryptSecret(s);
    const b = encryptSecret(s);
    expect(a).not.toContain(s);
    expect(a).not.toBe(b);
  });

  it("detects tampering", () => {
    const parts = encryptSecret("hello world secret").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("refuses to run without a valid key", () => {
    const saved = process.env.APP_ENCRYPTION_KEY;
    process.env.APP_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/APP_ENCRYPTION_KEY/);
    process.env.APP_ENCRYPTION_KEY = saved;
  });

  it("masks all but the last 4 characters", () => {
    expect(maskSecret("abcdefgh1234").endsWith("1234")).toBe(true);
    expect(maskSecret("abcdefgh1234")).not.toContain("abcdefgh");
    expect(maskSecret("ab")).not.toContain("ab");
  });
});
