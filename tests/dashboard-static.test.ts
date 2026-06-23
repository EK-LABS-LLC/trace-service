import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Dashboard static serving", () => {
  let app: Awaited<ReturnType<typeof loadApp>>;

  beforeAll(async () => {
    app = await loadApp();
  });

  test("serves dashboard index from root", async () => {
    const response = await app.request("/");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Pulse Dashboard");
  });

  test("serves SPA fallback for dashboard routes", async () => {
    const response = await app.request("/dashboard/traces");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Pulse Dashboard");
  });

  test("serves runtime config from same origin", async () => {
    const response = await app.request("/runtime-config.js");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/javascript",
    );
    expect(body).toContain("window.__PULSE_CONFIG");
    expect(body).toContain("apiBaseUrl");
  });

  test("does not swallow unknown API routes", async () => {
    const response = await app.request("/v1/not-a-route");

    expect(response.status).toBe(404);
  });
});

async function loadApp() {
  process.env.PULSE_HOME = mkdtempSync(join(tmpdir(), "pulse-dashboard-test-"));
  process.env.DASHBOARD_DIST_DIR = mkdtempSync(
    join(tmpdir(), "pulse-dashboard-dist-"),
  );
  writeFileSync(
    join(process.env.DASHBOARD_DIST_DIR, "index.html"),
    "<!doctype html><html><head><title>Pulse Dashboard</title></head><body><div id=\"root\"></div></body></html>",
    "utf8",
  );

  const [
    { initializeRuntimeServices, isRuntimeServicesInitialized },
    { createSingleRuntimeServices },
  ] =
    await Promise.all([
      import("../runtime/services"),
      import("../runtime/modes/single"),
    ]);

  if (!isRuntimeServicesInitialized()) {
    const runtime = createSingleRuntimeServices();
    initializeRuntimeServices(runtime);
    await runtime.bootstrapDb();
  }

  const { createApp } = await import("../app");
  return createApp();
}
