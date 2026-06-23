import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveLocalSecrets } from "./local-secrets";

function tempPulseHome(): string {
  return mkdtempSync(join(tmpdir(), "pulse-local-secrets-test-"));
}

describe("local server secrets", () => {
  test("creates persistent secrets for single mode when env vars are missing", () => {
    const pulseHome = tempPulseHome();
    const secrets = resolveLocalSecrets({}, pulseHome);
    const saved = JSON.parse(
      readFileSync(join(pulseHome, "server-secrets.json"), "utf8"),
    ) as Record<string, string>;

    expect(secrets.BETTER_AUTH_SECRET).toHaveLength(64);
    expect(secrets.ENCRYPTION_KEY).toHaveLength(64);
    expect(saved.BETTER_AUTH_SECRET).toBe(secrets.BETTER_AUTH_SECRET);
    expect(saved.ENCRYPTION_KEY).toBe(secrets.ENCRYPTION_KEY);
  });

  test("reuses persisted secrets across starts", () => {
    const pulseHome = tempPulseHome();
    const first = resolveLocalSecrets({}, pulseHome);
    const second = resolveLocalSecrets({}, pulseHome);

    expect(second).toEqual(first);
  });

  test("does not override explicit env secrets", () => {
    const pulseHome = tempPulseHome();
    const secrets = resolveLocalSecrets(
      {
        BETTER_AUTH_SECRET: "auth-secret-that-is-at-least-32-chars",
        ENCRYPTION_KEY: "encryption-key-that-is-at-least-32-chars",
      },
      pulseHome,
    );

    expect(secrets).toEqual({});
  });

  test("fills only missing env secrets", () => {
    const pulseHome = tempPulseHome();
    const secrets = resolveLocalSecrets(
      {
        BETTER_AUTH_SECRET: "auth-secret-that-is-at-least-32-chars",
      },
      pulseHome,
    );

    expect(secrets.BETTER_AUTH_SECRET).toBeUndefined();
    expect(secrets.ENCRYPTION_KEY).toHaveLength(64);
  });

  test("does not generate local secrets in scale mode", () => {
    const pulseHome = tempPulseHome();
    const secrets = resolveLocalSecrets({ PULSE_MODE: "scale" }, pulseHome);

    expect(secrets).toEqual({});
  });

  test("writes the secrets file with owner-only permissions", () => {
    const pulseHome = tempPulseHome();
    resolveLocalSecrets({}, pulseHome);

    const mode = statSync(join(pulseHome, "server-secrets.json")).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
