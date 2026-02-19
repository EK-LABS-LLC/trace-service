import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface ResolvedDataPaths {
  pulseHome: string;
  pulseDataDir: string;
  databasePath: string;
  walDir: string;
  walSpanDir: string;
}

function expandHomePath(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function resolvePath(pathValue: string): string {
  const expanded = expandHomePath(pathValue);
  if (isAbsolute(expanded)) {
    return expanded;
  }
  return resolve(expanded);
}

function resolveDefaultPulseHome(): string {
  const home = homedir();
  if (!home) {
    return resolve(".pulse");
  }
  return join(home, ".pulse");
}

export function resolveDataPaths(input: NodeJS.ProcessEnv = process.env): ResolvedDataPaths {
  const pulseHome = input.PULSE_HOME
    ? resolvePath(input.PULSE_HOME)
    : resolveDefaultPulseHome();

  const databasePath = input.DATABASE_PATH ? resolvePath(input.DATABASE_PATH) : undefined;

  const pulseDataDir = input.PULSE_DATA_DIR
    ? resolvePath(input.PULSE_DATA_DIR)
    : databasePath
      ? dirname(databasePath)
    : join(pulseHome, ".data");

  return {
    pulseHome,
    pulseDataDir,
    databasePath: databasePath ?? join(pulseDataDir, "pulse.db"),
    walDir: input.WAL_DIR ? resolvePath(input.WAL_DIR) : join(pulseDataDir, "wal"),
    walSpanDir: input.WAL_SPAN_DIR
      ? resolvePath(input.WAL_SPAN_DIR)
      : join(pulseDataDir, "wal-spans"),
  };
}

export function resolveOptionalPath(pathValue: string | undefined): string | undefined {
  if (!pathValue) {
    return undefined;
  }
  return resolvePath(pathValue);
}
