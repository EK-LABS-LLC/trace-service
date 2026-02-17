type Args = {
  baseUrl: string;
  email?: string;
  password?: string;
  name: string;
  projectId?: string;
  projectName: string;
  apiKey?: string;
  sessions: number;
  tracesPerSession: number;
  spansPerSession: number;
  daysBack: number;
};

type ProjectCreateResponse = {
  projectId: string;
  apiKey: string;
  name: string;
};

const PROVIDERS = ["openai", "anthropic", "openrouter"] as const;
const MODELS: Record<(typeof PROVIDERS)[number], string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
  openrouter: ["meta-llama/llama-3-70b-instruct", "mistralai/mixtral-8x7b"],
};

function getArg(name: string): string | undefined {
  const key = `--${name}=`;
  const found = Bun.argv.find((a) => a.startsWith(key));
  return found ? found.slice(key.length) : undefined;
}

function parseIntArg(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(): Args {
  return {
    baseUrl: getArg("base-url") ?? process.env.SEED_BASE_URL ?? "http://localhost:3000",
    email: getArg("email") ?? process.env.SEED_EMAIL,
    password: getArg("password") ?? process.env.SEED_PASSWORD,
    name: getArg("name") ?? process.env.SEED_NAME ?? "Seed User",
    projectId: getArg("project-id") ?? process.env.SEED_PROJECT_ID,
    projectName:
      getArg("project-name") ??
      process.env.SEED_PROJECT_NAME ??
      `Seed Project ${new Date().toISOString().slice(0, 10)}`,
    apiKey: getArg("api-key") ?? process.env.SEED_API_KEY,
    sessions: parseIntArg(getArg("sessions") ?? process.env.SEED_SESSIONS, 50),
    tracesPerSession: parseIntArg(
      getArg("traces-per-session") ?? process.env.SEED_TRACES_PER_SESSION,
      20,
    ),
    spansPerSession: parseIntArg(
      getArg("spans-per-session") ?? process.env.SEED_SPANS_PER_SESSION,
      30,
    ),
    daysBack: parseIntArg(getArg("days-back") ?? process.env.SEED_DAYS_BACK, 14),
  };
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
  return match ? `better-auth.session_token=${match[1]}` : null;
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function requireOk(response: Response, context: string): Promise<void> {
  if (response.ok) return;
  const text = await response.text();
  throw new Error(`${context} failed (${response.status}): ${text}`);
}

async function signIn(baseUrl: string, email: string, password: string): Promise<string | null> {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  return extractSessionCookie(response.headers.get("set-cookie"));
}

async function signUpWithProject(
  baseUrl: string,
  name: string,
  email: string,
  password: string,
  projectName: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/dashboard/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, projectName }),
  });
  await requireOk(response, "signup");
}

async function ensureSessionCookie(args: Args): Promise<string> {
  if (!args.email || !args.password) {
    throw new Error(
      "Missing credentials. Provide --email and --password (or SEED_EMAIL/SEED_PASSWORD).",
    );
  }

  const existing = await signIn(args.baseUrl, args.email, args.password);
  if (existing) return existing;

  await signUpWithProject(
    args.baseUrl,
    args.name,
    args.email,
    args.password,
    args.projectName,
  );

  const afterSignup = await signIn(args.baseUrl, args.email, args.password);
  if (!afterSignup) {
    throw new Error("Failed to sign in after signup.");
  }
  return afterSignup;
}

async function sessionFetch(
  args: Args,
  sessionCookie: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${args.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Cookie: sessionCookie,
    },
  });
}

async function getOrCreateApiKey(
  args: Args,
  sessionCookie: string,
  projectId: string,
): Promise<string> {
  const listResponse = await sessionFetch(args, sessionCookie, "/dashboard/api/api-keys", {
    headers: { "X-Project-Id": projectId },
  });
  await requireOk(listResponse, "list api keys");
  const listData = await parseJson<{
    keys: Array<{ key: string }>;
  }>(listResponse);

  if (listData.keys.length > 0) {
    return listData.keys[0]!.key;
  }

  const createResponse = await sessionFetch(args, sessionCookie, "/dashboard/api/api-keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Project-Id": projectId,
    },
    body: JSON.stringify({ name: "Seed Key" }),
  });
  await requireOk(createResponse, "create api key");
  const createData = await parseJson<{ apiKey: string }>(createResponse);
  return createData.apiKey;
}

async function resolveProjectAndApiKey(
  args: Args,
): Promise<{ projectId: string; apiKey: string; created: boolean }> {
  if (args.apiKey && args.projectId) {
    return { projectId: args.projectId, apiKey: args.apiKey, created: false };
  }

  const sessionCookie = await ensureSessionCookie(args);

  if (args.projectId) {
    const apiKey = args.apiKey ?? (await getOrCreateApiKey(args, sessionCookie, args.projectId));
    return { projectId: args.projectId, apiKey, created: false };
  }

  const createProjectResponse = await sessionFetch(args, sessionCookie, "/dashboard/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: args.projectName }),
  });
  await requireOk(createProjectResponse, "create project");
  const project = await parseJson<ProjectCreateResponse>(createProjectResponse);
  return { projectId: project.projectId, apiKey: project.apiKey, created: true };
}

async function ingestBatch(
  args: Args,
  apiKey: string,
  path: "/v1/traces/batch" | "/v1/spans/batch",
  items: unknown[],
): Promise<void> {
  if (items.length === 0) return;
  const response = await fetch(`${args.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(items),
  });
  await requireOk(response, `ingest ${path}`);
}

async function flushInChunks(
  args: Args,
  apiKey: string,
  path: "/v1/traces/batch" | "/v1/spans/batch",
  items: unknown[],
): Promise<void> {
  const maxBatch = 100;
  for (let i = 0; i < items.length; i += maxBatch) {
    const chunk = items.slice(i, i + maxBatch);
    await ingestBatch(args, apiKey, path, chunk);
  }
}

async function seedData(args: Args, apiKey: string): Promise<{ traces: number; spans: number }> {
  const dateFrom = Date.now() - args.daysBack * 24 * 60 * 60 * 1000;
  let totalTraces = 0;
  let totalSpans = 0;
  const tracesBuffer: unknown[] = [];
  const spansBuffer: unknown[] = [];

  for (let i = 0; i < args.sessions; i++) {
    const sessionId = crypto.randomUUID();
    let currentTs = randomInt(dateFrom, Date.now());

    for (let j = 0; j < args.tracesPerSession; j++) {
      const provider = randomItem(PROVIDERS);
      const model = randomItem(MODELS[provider]);
      const isError = Math.random() < 0.06;
      const inputTokens = randomInt(80, 2200);
      const outputTokens = isError ? 0 : randomInt(50, 1800);

      tracesBuffer.push({
        trace_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: new Date(currentTs).toISOString(),
        provider,
        model_requested: model,
        model_used: model,
        latency_ms: isError ? randomInt(50, 700) : randomInt(200, 2800),
        status: isError ? "error" : "success",
        request_body: {
          model,
          messages: [{ role: "user", content: "Seeded request payload" }],
        },
        response_body: isError ? undefined : { id: crypto.randomUUID(), choices: [] },
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        output_text: isError ? undefined : "Seeded model response",
        finish_reason: isError ? undefined : "stop",
        error: isError ? { message: "Seeded synthetic error" } : undefined,
        metadata: { source: "seed-script", sessionIndex: i },
      });
      totalTraces++;
      currentTs += randomInt(500, 8000);
    }

    for (let k = 0; k < args.spansPerSession; k++) {
      const kind = randomItem([
        "tool_use",
        "agent_run",
        "session",
        "user_prompt",
        "notification",
      ] as const);
      const isError = Math.random() < 0.04;

      spansBuffer.push({
        span_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: new Date(currentTs).toISOString(),
        duration_ms: randomInt(5, 3000),
        source: "claude_code",
        kind,
        event_type:
          kind === "tool_use"
            ? "post_tool_use"
            : kind === "agent_run"
              ? "subagent_stop"
              : kind === "user_prompt"
                ? "user_message"
                : kind === "session"
                  ? "session_update"
                  : "notify",
        status: isError ? "error" : "success",
        tool_use_id: kind === "tool_use" ? crypto.randomUUID() : undefined,
        tool_name: kind === "tool_use" ? randomItem(["Bash", "Read", "Edit"]) : undefined,
        tool_input: kind === "tool_use" ? { command: "echo seeded" } : undefined,
        tool_response: kind === "tool_use" ? { output: "seeded output" } : undefined,
        error: isError ? { message: "Seeded synthetic span error" } : undefined,
        cwd: "/workspace",
        model: randomItem(["gpt-5", "gpt-4o", "claude-3-sonnet"]),
        agent_name: kind === "agent_run" ? randomItem(["Plan", "Explore", "Code"]) : undefined,
        metadata: { source: "seed-script", sessionIndex: i },
      });
      totalSpans++;
      currentTs += randomInt(200, 5000);
    }

    if (tracesBuffer.length >= 100) {
      await flushInChunks(args, apiKey, "/v1/traces/batch", tracesBuffer.splice(0));
    }
    if (spansBuffer.length >= 100) {
      await flushInChunks(args, apiKey, "/v1/spans/batch", spansBuffer.splice(0));
    }

    if ((i + 1) % 10 === 0 || i + 1 === args.sessions) {
      console.log(
        `Seed progress: sessions=${i + 1}/${args.sessions}, traces=${totalTraces}, spans=${totalSpans}`,
      );
    }
  }

  await flushInChunks(args, apiKey, "/v1/traces/batch", tracesBuffer);
  await flushInChunks(args, apiKey, "/v1/spans/batch", spansBuffer);

  return { traces: totalTraces, spans: totalSpans };
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log(`Seeding via API at ${args.baseUrl}`);
  const project = await resolveProjectAndApiKey(args);
  console.log(
    `Using project ${project.projectId} (${project.created ? "created" : "existing"})`,
  );

  const result = await seedData(args, project.apiKey);

  console.log("Seed complete.");
  console.log(`Project ID: ${project.projectId}`);
  console.log(`API Key: ${project.apiKey}`);
  console.log(`Traces seeded: ${result.traces}`);
  console.log(`Spans seeded: ${result.spans}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
