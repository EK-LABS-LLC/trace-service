import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const SECRET_BYTES = 32;
const SECRETS_FILE = "server-secrets.json";

type LocalSecrets = {
  BETTER_AUTH_SECRET?: string;
  ENCRYPTION_KEY?: string;
};

function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString("hex");
}

function readSecrets(path: string): LocalSecrets {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as LocalSecrets;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeSecrets(path: string, secrets: Required<LocalSecrets>): void {
  writeFileSync(path, `${JSON.stringify(secrets, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

export function resolveLocalSecrets(
  input: NodeJS.ProcessEnv,
  pulseHome: string,
): LocalSecrets {
  if (input.PULSE_MODE === "scale") {
    return {};
  }

  if (input.BETTER_AUTH_SECRET && input.ENCRYPTION_KEY) {
    return {};
  }

  mkdirSync(pulseHome, { recursive: true });
  const secretsPath = join(pulseHome, SECRETS_FILE);
  const persisted = readSecrets(secretsPath);
  const secrets = {
    BETTER_AUTH_SECRET:
      persisted.BETTER_AUTH_SECRET && persisted.BETTER_AUTH_SECRET.length >= 32
        ? persisted.BETTER_AUTH_SECRET
        : generateSecret(),
    ENCRYPTION_KEY:
      persisted.ENCRYPTION_KEY && persisted.ENCRYPTION_KEY.length >= 32
        ? persisted.ENCRYPTION_KEY
        : generateSecret(),
  };

  writeSecrets(secretsPath, secrets);

  const resolved: LocalSecrets = {};
  if (!input.BETTER_AUTH_SECRET) {
    resolved.BETTER_AUTH_SECRET = secrets.BETTER_AUTH_SECRET;
  }
  if (!input.ENCRYPTION_KEY) {
    resolved.ENCRYPTION_KEY = secrets.ENCRYPTION_KEY;
  }
  return resolved;
}
