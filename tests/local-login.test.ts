import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("local dashboard login", () => {
  let app: Awaited<ReturnType<typeof loadApp>>;

  beforeAll(async () => {
    app = await loadApp();
  });

  test("creates a dashboard session from a local API key", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [{ auth }, { db }, { createProjectForUser }] = await Promise.all([
      import("../auth/auth"),
      import("../db"),
      import("../services/admin"),
    ]);

    const signup = await auth.api.signUpEmail({
      body: {
        name: "Local User",
        email: `local-${suffix}@pulse.test`,
        password: "IntegrationPass!123",
      },
    });
    const project = await createProjectForUser(`Local ${suffix}`, signup.user.id, db);

    const tokenResponse = await app.request("http://127.0.0.1/dashboard/api/local-login-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: project.apiKey,
        project_id: project.projectId,
        redirect_url: "http://127.0.0.1/dashboard",
      }),
    });

    expect(tokenResponse.status).toBe(201);
    const token = (await tokenResponse.json()) as { login_url: string };
    const loginPath = new URL(token.login_url).pathname + new URL(token.login_url).search;

    const loginResponse = await app.request(`http://127.0.0.1${loginPath}`, {
      redirect: "manual",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.get("location")).toBe("http://127.0.0.1/dashboard");

    const sessionCookie = extractSessionCookie(loginResponse.headers.get("set-cookie"));
    expect(sessionCookie).toBeTruthy();

    const projectsResponse = await app.request("http://127.0.0.1/dashboard/api/projects", {
      headers: {
        Cookie: sessionCookie!,
      },
    });

    expect(projectsResponse.status).toBe(200);
    const projects = (await projectsResponse.json()) as {
      projects: Array<{ id: string }>;
    };
    expect(projects.projects.some((row) => row.id === project.projectId)).toBe(true);
  });
});

async function loadApp() {
  process.env.PULSE_HOME = mkdtempSync(join(tmpdir(), "pulse-local-login-test-"));
  process.env.DASHBOARD_DIST_DIR = mkdtempSync(join(tmpdir(), "pulse-local-login-dist-"));
  writeFileSync(
    join(process.env.DASHBOARD_DIST_DIR, "index.html"),
    '<!doctype html><html><head><title>Pulse Dashboard</title></head><body><div id="root"></div></body></html>',
    "utf8"
  );

  const [
    { initializeRuntimeServices, isRuntimeServicesInitialized },
    { createSingleRuntimeServices },
  ] = await Promise.all([import("../runtime/services"), import("../runtime/modes/single")]);

  if (!isRuntimeServicesInitialized()) {
    const runtime = createSingleRuntimeServices();
    initializeRuntimeServices(runtime);
    await runtime.bootstrapDb();
  }

  const { createApp } = await import("../app");
  return createApp();
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
  return match ? `better-auth.session_token=${match[1]}` : null;
}
