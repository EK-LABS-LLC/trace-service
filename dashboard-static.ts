import { dirname, extname, join } from "node:path";
import { existsSync } from "node:fs";
import type { Context } from "hono";
import { env } from "./config";

const API_PREFIXES = ["/api/", "/dashboard/api/", "/v1/"];
const RESERVED_PATHS = new Set(["/health"]);

let resolvedDashboardDistDir: string | null | undefined;

function resolveDashboardDistDir(): string | null {
  if (resolvedDashboardDistDir !== undefined) {
    return resolvedDashboardDistDir;
  }

  const candidates = [
    env.DASHBOARD_DIST_DIR,
    join(dirname(process.execPath), "dashboard"),
    join(import.meta.dir, "dist", "dashboard"),
    join(import.meta.dir, "dashboard", "dist"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      resolvedDashboardDistDir = candidate;
      return candidate;
    }
  }

  resolvedDashboardDistDir = null;
  return null;
}

function isReservedPath(path: string): boolean {
  return RESERVED_PATHS.has(path) || API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isAssetLikePath(path: string): boolean {
  return path.startsWith("/assets/") || extname(path) !== "";
}

function notFound(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function fileResponse(filePath: string): Response {
  const file = Bun.file(filePath);
  const headers = file.type
    ? {
        "Content-Type": file.type,
      }
    : undefined;

  return new Response(file, { headers });
}

function runtimeConfigResponse(): Response {
  const body =
    "window.__PULSE_CONFIG = Object.assign({}, window.__PULSE_CONFIG, " +
    JSON.stringify({
      apiBaseUrl: env.BETTER_AUTH_URL,
    }) +
    ");\n";

  return new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function serveDashboard(c: Context): Promise<Response> {
  const path = c.req.path;
  if (isReservedPath(path)) {
    return c.notFound();
  }

  const distDir = resolveDashboardDistDir();
  if (!distDir) {
    return notFound(
      "Pulse dashboard assets were not found. Build the in-repo dashboard source and make its dist directory available to pulse-server.",
    );
  }

  if (path === "/runtime-config.js") {
    return runtimeConfigResponse();
  }

  const relativePath = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  if (relativePath.includes("..")) {
    return c.notFound();
  }

  const assetPath = join(distDir, relativePath);
  const asset = Bun.file(assetPath);
  if (await asset.exists()) {
    return fileResponse(assetPath);
  }

  if (isAssetLikePath(path)) {
    return c.notFound();
  }

  return fileResponse(join(distDir, "index.html"));
}
