import { describe, test, expect, beforeAll } from "bun:test";
import { encryptApiKey, decryptApiKey } from "./crypto";

describe("API Key Encryption", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-long-for-testing";
  });

  test("encrypt and decrypt returns original value", () => {
    const original = "pulse_sk_test-api-key-12345";
    const encrypted = encryptApiKey(original);
    const decrypted = decryptApiKey(encrypted);

    expect(decrypted).toBe(original);
  });

  test("encrypting same value twice produces different outputs", () => {
    const value = "pulse_sk_test-api-key-12345";
    const encrypted1 = encryptApiKey(value);
    const encrypted2 = encryptApiKey(value);

    // Different due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to the same value
    expect(decryptApiKey(encrypted1)).toBe(value);
    expect(decryptApiKey(encrypted2)).toBe(value);
  });

  test("decrypted value matches original after database roundtrip", async () => {
    const original = "pulse_sk_test-api-key-12345";
    const encrypted = encryptApiKey(original);

    // Simulate storing and retrieving from database
    // In reality this would go through the database, but we're testing
    // that the base64 string survives encoding/decoding
    const stored = Buffer.from(encrypted).toString("base64");
    const retrieved = Buffer.from(stored, "base64").toString();

    expect(decryptApiKey(retrieved)).toBe(original);
  });

  test("different encryption keys cannot decrypt", () => {
    const original = "pulse_sk_test-api-key-12345";

    process.env.ENCRYPTION_KEY = "key-one-32-characters-long-for-test";
    const encrypted = encryptApiKey(original);

    process.env.ENCRYPTION_KEY = "key-two-32-characters-long-for-test";
    expect(() => decryptApiKey(encrypted)).toThrow();
  });
});
