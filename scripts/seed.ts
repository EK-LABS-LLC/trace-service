/**
 * Seeds a project with realistic OTel-shaped spans via POST /v1/spans/batch.
 *
 * Each seeded session is: one `session_start` span, N agent turns (each its
 * own `trace_id`), then one `session_end` span. Most sessions are
 * `claude_code` agent turns (user_prompt_submit -> tool_use spans ->
 * optional subagent_run -> stop), some are `codex` agent turns, and some are
 * `sdk` sessions made of `llm_call` spans carrying provider/model/tokens/cost.
 *
 * Usage:
 *   bun run scripts/seed.ts [options]
 *   bun run db:seed -- [options]
 *
 * Options (flag or env var):
 *   --base-url=<url>              SEED_BASE_URL        (default http://localhost:3000)
 *   --email=<email>               SEED_EMAIL            required unless --api-key/--project-id given
 *   --password=<password>         SEED_PASSWORD         required unless --api-key/--project-id given
 *   --name=<name>                 SEED_NAME             (default "Seed User")
 *   --project-id=<id>             SEED_PROJECT_ID       reuse an existing project
 *   --project-name=<name>         SEED_PROJECT_NAME     (default "Seed Project <date>")
 *   --api-key=<key>               SEED_API_KEY          reuse an existing API key
 *   --sessions=<n>                SEED_SESSIONS         number of sessions to create (default 50)
 *   --traces-per-session=<n>      SEED_TRACES_PER_SESSION  agent turns per session (default 8)
 *   --spans-per-session=<n>       SEED_SPANS_PER_SESSION   max tool-use spans per turn (default 4)
 *   --days-back=<n>               SEED_DAYS_BACK        how far back session timestamps span (default 14)
 */

type Args = {
  baseUrl: string;
  email?: string;
  password?: string;
  name: string;
  projectId?: string;
  projectName: string;
  apiKey?: string;
  sessions: number;
  turnsPerSession: number;
  toolSpansPerTurn: number;
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

type ModelCostRate = {
  inputPer1kCents: number;
  outputPer1kCents: number;
};

const MODEL_COST_RATES: Record<string, ModelCostRate> = {
  "gpt-4o": { inputPer1kCents: 0.5, outputPer1kCents: 1.5 },
  "gpt-4o-mini": { inputPer1kCents: 0.015, outputPer1kCents: 0.06 },
  "gpt-4-turbo": { inputPer1kCents: 1.0, outputPer1kCents: 3.0 },
  "claude-3-opus-20240229": { inputPer1kCents: 1.5, outputPer1kCents: 7.5 },
  "claude-3-sonnet-20240229": { inputPer1kCents: 0.3, outputPer1kCents: 1.5 },
  "meta-llama/llama-3-70b-instruct": {
    inputPer1kCents: 0.08,
    outputPer1kCents: 0.08,
  },
  "mistralai/mixtral-8x7b": { inputPer1kCents: 0.06, outputPer1kCents: 0.06 },
};

const DEFAULT_MODEL_COST_RATE: ModelCostRate = {
  inputPer1kCents: 0.1,
  outputPer1kCents: 0.2,
};

type AgentSource = "claude_code" | "codex";

const AGENT_MODELS: Record<AgentSource, string[]> = {
  claude_code: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
  codex: ["gpt-5.1-codex", "gpt-5.1-codex-mini"],
};

const AGENT_TOOLS: Record<AgentSource, string[]> = {
  claude_code: [
    "Bash",
    "Read",
    "Grep",
    "WebSearch",
    "Edit",
    "Write",
    "MultiEdit",
  ],
  codex: ["shell", "read_file", "apply_patch"],
};

// Must match EDIT_TOOL_NAMES in services/derived-traces.ts so seeded turns
// actually produce "N tool calls · M files edited" summaries.
const EDIT_TOOL_NAMES = new Set(["Edit", "Write", "MultiEdit", "apply_patch"]);

const FILE_POOL = [
  "src/index.ts",
  "src/routes/traces.ts",
  "src/services/derived-traces.ts",
  "src/db/schema.ts",
  "tests/traces.test.ts",
  "README.md",
  "package.json",
  "src/components/TracesTable.tsx",
];

const SUBAGENT_NAMES = ["Explore", "Plan", "general-purpose", "code-reviewer"];

// Shared error-injection knob: chance a given tool call or llm_call fails.
const ERROR_RATE = 0.06;
// Fraction of agent turns that spawn a subagent_start/subagent_stop pair.
const SUBAGENT_RATE = 0.15;

function getArg(name: string): string | undefined {
  const key = `--${name}=`;
  const found = Bun.argv.find((a) => a.startsWith(key));
  return found ? found.slice(key.length) : undefined;
}

function parseIntArg(
  value: string | undefined,
  fallback: number,
  options?: { min?: number },
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  const min = options?.min ?? 1;
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function parseArgs(): Args {
  return {
    baseUrl:
      getArg("base-url") ??
      process.env.SEED_BASE_URL ??
      "http://localhost:3000",
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
    // Agent turns per session. Flag/env name kept as "traces-per-session" for
    // CLI compatibility, but a turn is now what forms one trace_id.
    turnsPerSession: parseIntArg(
      getArg("traces-per-session") ?? process.env.SEED_TRACES_PER_SESSION,
      8,
      { min: 0 },
    ),
    // Max tool-use spans per agent turn (sdk turns ignore this; they seed a
    // single llm_call span plus an occasional tool_use child).
    toolSpansPerTurn: parseIntArg(
      getArg("spans-per-session") ?? process.env.SEED_SPANS_PER_SESSION,
      4,
      { min: 0 },
    ),
    daysBack: parseIntArg(
      getArg("days-back") ?? process.env.SEED_DAYS_BACK,
      14,
      { min: 0 },
    ),
  };
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = MODEL_COST_RATES[model] ?? DEFAULT_MODEL_COST_RATE;
  const baseCents =
    (inputTokens / 1000) * rate.inputPer1kCents +
    (outputTokens / 1000) * rate.outputPer1kCents;

  // Add a small variance so seeded data does not look unnaturally uniform.
  const varianceMultiplier = randomInt(92, 108) / 100;
  return Number((baseCents * varianceMultiplier).toFixed(4));
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

async function signIn(
  baseUrl: string,
  email: string,
  password: string,
): Promise<string | null> {
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
  const listResponse = await sessionFetch(
    args,
    sessionCookie,
    "/dashboard/api/api-keys",
    {
      headers: { "X-Project-Id": projectId },
    },
  );
  await requireOk(listResponse, "list api keys");
  const listData = await parseJson<{
    keys: Array<{ key: string }>;
  }>(listResponse);

  if (listData.keys.length > 0) {
    return listData.keys[0]!.key;
  }

  const createResponse = await sessionFetch(
    args,
    sessionCookie,
    "/dashboard/api/api-keys",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Id": projectId,
      },
      body: JSON.stringify({ name: "Seed Key" }),
    },
  );
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
    const apiKey =
      args.apiKey ??
      (await getOrCreateApiKey(args, sessionCookie, args.projectId));
    return { projectId: args.projectId, apiKey, created: false };
  }

  const createProjectResponse = await sessionFetch(
    args,
    sessionCookie,
    "/dashboard/api/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.projectName }),
    },
  );
  await requireOk(createProjectResponse, "create project");
  const project = await parseJson<ProjectCreateResponse>(createProjectResponse);
  return {
    projectId: project.projectId,
    apiKey: project.apiKey,
    created: true,
  };
}

async function ingestSpansBatch(
  args: Args,
  apiKey: string,
  items: unknown[],
): Promise<void> {
  if (items.length === 0) return;
  const response = await fetch(`${args.baseUrl}/v1/spans/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(items),
  });
  await requireOk(response, "ingest /v1/spans/batch");
}

async function flushInChunks(
  args: Args,
  apiKey: string,
  items: unknown[],
): Promise<void> {
  const maxBatch = 100;
  for (let i = 0; i < items.length; i += maxBatch) {
    const chunk = items.slice(i, i + maxBatch);
    await ingestSpansBatch(args, apiKey, chunk);
  }
}

function pickSessionSource(): AgentSource | "sdk" {
  const roll = Math.random();
  if (roll < 0.7) return "claude_code";
  if (roll < 0.9) return "codex";
  return "sdk";
}

/**
 * One agent turn: user_prompt_submit -> N tool_use pairs -> optional
 * subagent_start/subagent_stop -> stop. All spans share one trace_id.
 */
function buildAgentTurn(
  source: AgentSource,
  sessionId: string,
  startTs: number,
  sessionIndex: number,
  toolSpansPerTurn: number,
): { spans: unknown[]; nextTs: number } {
  const spans: unknown[] = [];
  const traceId = crypto.randomUUID();
  const model = randomItem(AGENT_MODELS[source]);
  let ts = startTs;
  let turnHasError = false;

  spans.push({
    span_id: crypto.randomUUID(),
    trace_id: traceId,
    session_id: sessionId,
    timestamp: new Date(ts).toISOString(),
    duration_ms: randomInt(5, 40),
    source,
    kind: "user_prompt",
    event_type: "user_prompt_submit",
    status: "success",
    cwd: "/workspace/project",
    model,
    metadata: { source: "seed-script", sessionIndex },
  });
  ts += randomInt(200, 1500);

  const toolCallCount =
    toolSpansPerTurn > 0 ? randomInt(0, toolSpansPerTurn) : 0;
  for (let t = 0; t < toolCallCount; t++) {
    const toolUseId = crypto.randomUUID();
    const toolName = randomItem(AGENT_TOOLS[source]);
    const isEdit = EDIT_TOOL_NAMES.has(toolName);
    const toolInput = isEdit
      ? { file_path: randomItem(FILE_POOL) }
      : toolName === "Bash" || toolName === "shell"
        ? { command: "echo seeded" }
        : { query: "seeded search" };

    spans.push({
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      source,
      kind: "tool_use",
      event_type: "pre_tool_use",
      status: "success",
      tool_use_id: toolUseId,
      tool_name: toolName,
      tool_input: toolInput,
      cwd: "/workspace/project",
      model,
      metadata: { source: "seed-script", sessionIndex },
    });

    const duration = randomInt(20, 4000);
    ts += duration;
    const isError = Math.random() < ERROR_RATE;
    if (isError) turnHasError = true;

    spans.push({
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      duration_ms: duration,
      source,
      kind: "tool_use",
      event_type: isError ? "post_tool_use_failure" : "post_tool_use",
      status: isError ? "error" : "success",
      tool_use_id: toolUseId,
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: isError ? undefined : { output: "seeded output" },
      error: isError ? { message: "Seeded synthetic tool error" } : undefined,
      cwd: "/workspace/project",
      model,
      metadata: { source: "seed-script", sessionIndex },
    });
    ts += randomInt(100, 800);
  }

  if (Math.random() < SUBAGENT_RATE) {
    const agentName = randomItem(SUBAGENT_NAMES);
    spans.push({
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      source,
      kind: "agent_run",
      event_type: "subagent_start",
      status: "success",
      agent_name: agentName,
      cwd: "/workspace/project",
      model,
      metadata: { source: "seed-script", sessionIndex },
    });
    const duration = randomInt(500, 6000);
    ts += duration;
    spans.push({
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      duration_ms: duration,
      source,
      kind: "agent_run",
      event_type: "subagent_stop",
      status: "success",
      agent_name: agentName,
      cwd: "/workspace/project",
      model,
      metadata: { source: "seed-script", sessionIndex },
    });
    ts += randomInt(100, 500);
  }

  spans.push({
    span_id: crypto.randomUUID(),
    trace_id: traceId,
    session_id: sessionId,
    timestamp: new Date(ts).toISOString(),
    duration_ms: ts - startTs,
    source,
    kind: "session",
    event_type: "stop",
    status: turnHasError ? "error" : "success",
    cwd: "/workspace/project",
    model,
    metadata: { source: "seed-script", sessionIndex },
  });
  ts += randomInt(500, 5000);

  return { spans, nextTs: ts };
}

/**
 * One SDK turn: a root llm_call span (provider/model/tokens/cost) with an
 * occasional tool_use child. All spans share one trace_id.
 */
function buildSdkTurn(
  sessionId: string,
  startTs: number,
  sessionIndex: number,
): { spans: unknown[]; nextTs: number } {
  const traceId = crypto.randomUUID();
  const provider = randomItem(PROVIDERS);
  const model = randomItem(MODELS[provider]);
  const isError = Math.random() < ERROR_RATE;
  const inputTokens = randomInt(80, 2200);
  const outputTokens = isError ? 0 : randomInt(50, 1800);
  const costCents = estimateCostCents(model, inputTokens, outputTokens);
  const duration = isError ? randomInt(50, 700) : randomInt(200, 2800);
  let ts = startTs;

  const spans: unknown[] = [
    {
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      duration_ms: duration,
      source: "sdk",
      kind: "llm_call",
      event_type: "provider_call",
      status: isError ? "error" : "success",
      provider,
      model,
      model_used: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: costCents,
      finish_reason: isError ? undefined : "stop",
      output_text: isError ? undefined : "Seeded model response",
      error: isError
        ? { message: "Seeded synthetic provider error" }
        : undefined,
      metadata: { source: "seed-script", sessionIndex },
    },
  ];
  ts += duration;

  if (!isError && Math.random() < 0.3) {
    spans.push({
      span_id: crypto.randomUUID(),
      trace_id: traceId,
      session_id: sessionId,
      timestamp: new Date(ts).toISOString(),
      duration_ms: randomInt(50, 1500),
      source: "sdk",
      kind: "tool_use",
      event_type: "tool_call",
      status: "success",
      tool_use_id: crypto.randomUUID(),
      tool_name: randomItem(["web_search", "code_interpreter"]),
      tool_input: { query: "seeded query" },
      tool_response: { output: "seeded output" },
      metadata: { source: "seed-script", sessionIndex },
    });
    ts += randomInt(100, 500);
  }
  ts += randomInt(500, 4000);

  return { spans, nextTs: ts };
}

/** One session: session_start, N agent/SDK turns, session_end. */
function buildSession(
  args: Args,
  sessionIndex: number,
  startTs: number,
): { spans: unknown[]; turns: number } {
  const sessionId = crypto.randomUUID();
  const source = pickSessionSource();
  const spans: unknown[] = [];
  let ts = startTs;

  spans.push({
    span_id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp: new Date(ts).toISOString(),
    source,
    kind: "session",
    event_type: "session_start",
    status: "success",
    cwd: "/workspace/project",
    metadata: { source: "seed-script", sessionIndex },
  });
  ts += randomInt(200, 2000);

  for (let turn = 0; turn < args.turnsPerSession; turn++) {
    const built =
      source === "sdk"
        ? buildSdkTurn(sessionId, ts, sessionIndex)
        : buildAgentTurn(
            source,
            sessionId,
            ts,
            sessionIndex,
            args.toolSpansPerTurn,
          );
    spans.push(...built.spans);
    ts = built.nextTs;
  }

  spans.push({
    span_id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp: new Date(ts).toISOString(),
    source,
    kind: "session",
    event_type: "session_end",
    status: "success",
    cwd: "/workspace/project",
    metadata: { source: "seed-script", sessionIndex },
  });

  return { spans, turns: args.turnsPerSession };
}

async function seedData(
  args: Args,
  apiKey: string,
): Promise<{ sessions: number; turns: number; spans: number }> {
  const dateFrom = Date.now() - args.daysBack * 24 * 60 * 60 * 1000;
  let totalTurns = 0;
  let totalSpans = 0;
  const spansBuffer: unknown[] = [];

  for (let i = 0; i < args.sessions; i++) {
    const startTs = randomInt(dateFrom, Date.now());
    const built = buildSession(args, i, startTs);
    spansBuffer.push(...built.spans);
    totalTurns += built.turns;
    totalSpans += built.spans.length;

    if (spansBuffer.length >= 100) {
      await flushInChunks(args, apiKey, spansBuffer.splice(0));
    }

    if ((i + 1) % 10 === 0 || i + 1 === args.sessions) {
      console.log(
        `Seed progress: sessions=${i + 1}/${args.sessions}, turns=${totalTurns}, spans=${totalSpans}`,
      );
    }
  }

  await flushInChunks(args, apiKey, spansBuffer);

  return { sessions: args.sessions, turns: totalTurns, spans: totalSpans };
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
  console.log(`Sessions seeded: ${result.sessions}`);
  console.log(`Turns (traces) seeded: ${result.turns}`);
  console.log(`Spans seeded: ${result.spans}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
