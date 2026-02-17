const BASE_URL = "http://localhost:3000";

export { BASE_URL };

const TEST_USER_EMAIL =
  process.env.TEST_USER_EMAIL || "integration-suite@pulse.test";
const TEST_USER_PASSWORD =
  process.env.TEST_USER_PASSWORD || "IntegrationPass!123";
const TEST_USER_NAME = process.env.TEST_USER_NAME || "Integration Suite User";

/**
 * Test project data for cleanup tracking
 */
interface TestProject {
  id: string;
  apiKey: string;
}

const testProjects: TestProject[] = [];
const projectApiKeys = new Map<string, string>();
let testUserSessionCookie: string | null = null;
let ensureUserSessionInFlight: Promise<string> | null = null;

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
  if (!match) return null;
  return `better-auth.session_token=${match[1]}`;
}

async function sessionFetch(
  path: string,
  sessionCookie: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: sessionCookie,
    },
  });
}

async function signInTestUser(): Promise<string | null> {
  const signInResponse = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }),
  });

  if (!signInResponse.ok) {
    return null;
  }

  return extractSessionCookie(signInResponse.headers.get("set-cookie"));
}

async function signUpTestUser(): Promise<void> {
  const bootstrapProject = `Bootstrap ${crypto.randomUUID().slice(0, 8)}`;
  const signUpResponse = await fetch(`${BASE_URL}/dashboard/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: TEST_USER_NAME,
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      projectName: bootstrapProject,
    }),
  });

  if (!signUpResponse.ok) {
    const text = await signUpResponse.text();
    throw new Error(
      `Failed to sign up shared test user (${signUpResponse.status}): ${text}`,
    );
  }
}

async function ensureTestUserSession(): Promise<string> {
  if (testUserSessionCookie) {
    return testUserSessionCookie;
  }

  if (ensureUserSessionInFlight) {
    return ensureUserSessionInFlight;
  }

  ensureUserSessionInFlight = (async () => {
    const existingSession = await signInTestUser();
    if (existingSession) {
      testUserSessionCookie = existingSession;
      return existingSession;
    }

    await signUpTestUser();

    const sessionAfterSignup = await signInTestUser();
    if (!sessionAfterSignup) {
      throw new Error("Failed to sign in shared test user after signup");
    }

    testUserSessionCookie = sessionAfterSignup;
    return sessionAfterSignup;
  })();

  try {
    return await ensureUserSessionInFlight;
  } finally {
    ensureUserSessionInFlight = null;
  }
}

/**
 * Create a test project with API key
 */
export async function createTestProject(
  name: string = "Test Project",
): Promise<TestProject> {
  console.log(`[setup] Creating test project: "${name}"`);
  const sessionCookie = await ensureTestUserSession();

  const createProjectResponse = await sessionFetch(
    "/dashboard/api/projects",
    sessionCookie,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );

  if (!createProjectResponse.ok) {
    const text = await createProjectResponse.text();
    throw new Error(
      `Failed to create test project (${createProjectResponse.status}): ${text}`,
    );
  }

  const projectData = (await createProjectResponse.json()) as {
    projectId: string;
    apiKey: string;
  };
  const testProject = { id: projectData.projectId, apiKey: projectData.apiKey };
  testProjects.push(testProject);
  projectApiKeys.set(testProject.id, testProject.apiKey);

  console.log(
    `[setup] Project created: ${projectData.projectId} (tracking ${testProjects.length} projects)`,
  );
  return testProject;
}

/**
 * Create test traces for a project
 */
export async function createTestTraces(
  projectId: string,
  count: number = 10,
  sessionId?: string,
): Promise<string[]> {
  const apiKey = projectApiKeys.get(projectId);
  if (!apiKey) {
    throw new Error(`No API key found for project ${projectId}`);
  }

  const sid = sessionId ?? crypto.randomUUID();

  const traceData = Array.from({ length: count }, (_, i) => ({
    trace_id: crypto.randomUUID(),
    session_id: sid,
    timestamp: new Date(Date.now() - i * 60000), // 1 minute apart
    latency_ms: 100 + Math.floor(Math.random() * 500),
    provider: ["openai", "anthropic", "openrouter"][i % 3] as string,
    model_requested: "gpt-4o",
    status: i === 0 ? "error" : "success", // First one is error
    request_body: { model: "gpt-4o", messages: [] },
    input_tokens: 100 + i * 10,
    output_tokens: 200 + i * 20,
    cost_cents: 0.5 + i * 0.1,
  }));

  const ingestResponse = await authFetch("/v1/traces/batch", apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(traceData),
  });

  if (!ingestResponse.ok) {
    const text = await ingestResponse.text();
    throw new Error(
      `Failed to ingest test traces (${ingestResponse.status}): ${text}`,
    );
  }

  const query = `/v1/traces?session_id=${encodeURIComponent(sid)}&limit=${count}`;
  const listResponse = await authFetch(query, apiKey);
  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(`Failed to list traces (${listResponse.status}): ${text}`);
  }

  const listData = (await listResponse.json()) as {
    traces: Array<{ traceId: string }>;
  };
  return listData.traces.map((t) => t.traceId);
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<void> {
  console.log(
    `[setup] Cleanup skipped (${testProjects.length} projects). API-only tests do not use direct DB cleanup.`,
  );
  testProjects.length = 0;
  projectApiKeys.clear();
  console.log("[setup] Cleanup complete");
}

/**
 * Make authenticated request
 */
export async function authFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {},
): Promise<Response> {
  const method = options.method || "GET";
  const keyPreview = apiKey.slice(0, 15) + "...";
  console.log(`[authFetch] ${method} ${path} (key: ${keyPreview})`);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  console.log(`[authFetch] ${method} ${path} -> ${response.status}`);
  return response;
}
