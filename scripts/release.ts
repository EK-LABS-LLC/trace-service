import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const DIST_DIR = "dist";
const ARTIFACTS = ["pulse-server", "pulse-server-scale"] as const;

function run(command: string[]): void {
  const proc = Bun.spawnSync({
    cmd: command,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1);
  }
}

function sha256(path: string): string {
  const bytes = readFileSync(path);
  return createHash("sha256").update(bytes).digest("hex");
}

run(["bun", "run", "build:pulse"]);
run(["bun", "run", "build:pulse-scale"]);

const lines: string[] = [];
for (const artifact of ARTIFACTS) {
  const fullPath = join(DIST_DIR, artifact);
  const digest = sha256(fullPath);
  const size = statSync(fullPath).size;
  lines.push(`${digest}  ${artifact}  ${size}`);
}

const outputPath = join(DIST_DIR, "checksums.txt");
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Wrote ${outputPath}`);
