import { faker } from "@faker-js/faker";
import { db } from "../db";
import {
  projects,
  apiKeys,
  sessions,
  traces,
  type NewTrace,
} from "../db/schema";
import { hashApiKey } from "../auth/queries";

// Configuration
const CONFIG = {
  numSessions: 1000,
  tracesPerSession: { min: 50, max: 100 },
  // Date range: last 30 days
  dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  dateTo: new Date(),
};

const PROVIDERS = ["openai", "anthropic", "openrouter"] as const;
type Provider = (typeof PROVIDERS)[number];

const MODELS: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: [
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  openrouter: [
    "meta-llama/llama-3-70b-instruct",
    "mistralai/mixtral-8x7b-instruct",
  ],
};

// Cost per 1k tokens (input/output) in cents
const COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.25, output: 1.0 },
  "gpt-4o-mini": { input: 0.015, output: 0.06 },
  "gpt-4-turbo": { input: 1.0, output: 3.0 },
  "gpt-3.5-turbo": { input: 0.05, output: 0.15 },
  "claude-3-opus-20240229": { input: 1.5, output: 7.5 },
  "claude-3-sonnet-20240229": { input: 0.3, output: 1.5 },
  "claude-3-haiku-20240307": { input: 0.025, output: 0.125 },
  "meta-llama/llama-3-70b-instruct": { input: 0.059, output: 0.079 },
  "mistralai/mixtral-8x7b-instruct": { input: 0.024, output: 0.024 },
};

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(from: Date, to: Date): Date {
  return new Date(
    from.getTime() + Math.random() * (to.getTime() - from.getTime()),
  );
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = COSTS[model] ?? { input: 0.1, output: 0.3 };
  return (
    (inputTokens / 1000) * pricing.input +
    (outputTokens / 1000) * pricing.output
  );
}

function generateTrace(
  projectId: string,
  sessionId: string,
  timestamp: Date,
): NewTrace {
  const provider = randomElement(PROVIDERS);
  const model = randomElement(MODELS[provider]);
  const isError = Math.random() < 0.05; // 5% error rate

  const inputTokens = randomBetween(50, 2000);
  const outputTokens = isError ? 0 : randomBetween(100, 4000);
  const latencyMs = isError
    ? randomBetween(100, 500)
    : randomBetween(200, 3000);
  const costCents = isError
    ? 0
    : calculateCost(model, inputTokens, outputTokens);

  const trace: NewTrace = {
    projectId,
    sessionId,
    timestamp,
    provider,
    modelRequested: model,
    modelUsed: model,
    latencyMs,
    inputTokens,
    outputTokens,
    costCents,
    status: isError ? "error" : "success",
    requestBody: {
      model,
      messages: [{ role: "user", content: faker.lorem.paragraph() }],
      max_tokens: 4096,
    },
    responseBody: isError
      ? null
      : {
          id: faker.string.uuid(),
          choices: [
            {
              message: {
                role: "assistant",
                content: faker.lorem.paragraphs(2),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
          },
        },
    outputText: isError ? null : faker.lorem.paragraphs(2),
    finishReason: isError ? null : "stop",
    error: isError
      ? {
          message: faker.helpers.arrayElement([
            "Rate limit exceeded",
            "Context length exceeded",
            "Service unavailable",
          ]),
        }
      : null,
    metadata: {
      userId: faker.string.uuid(),
      environment: faker.helpers.arrayElement([
        "production",
        "staging",
        "development",
      ]),
    },
  };

  return trace;
}

async function seed() {
  console.log("🌱 Starting seed...\n");

  // Create a test project
  const projectName = "Test Project";
  const apiKey = `pulse_sk_${faker.string.uuid()}`;
  const keyHash = hashApiKey(apiKey);

  console.log("📁 Creating project...");
  const [project] = await db
    .insert(projects)
    .values({ name: projectName })
    .returning();
  console.log(`   Project ID: ${project!.id}`);
  console.log(`   Project Name: ${projectName}`);

  // Create API key
  await db.insert(apiKeys).values({ projectId: project!.id, keyHash });
  console.log(`   API Key: ${apiKey}`);
  console.log("");

  // Generate sessions and traces
  console.log(`📊 Generating ${CONFIG.numSessions} sessions with traces...`);
  let totalTraces = 0;

  for (let i = 0; i < CONFIG.numSessions; i++) {
    // Create session
    const sessionDate = randomDate(CONFIG.dateFrom, CONFIG.dateTo);
    const [session] = await db
      .insert(sessions)
      .values({
        projectId: project!.id,
        createdAt: sessionDate,
        metadata: { userAgent: faker.internet.userAgent() },
      })
      .returning();

    // Generate traces for this session
    const numTraces = randomBetween(
      CONFIG.tracesPerSession.min,
      CONFIG.tracesPerSession.max,
    );
    const traceData: NewTrace[] = [];

    let traceTime = sessionDate;
    for (let j = 0; j < numTraces; j++) {
      // Each trace happens 1-60 seconds after the previous
      traceTime = new Date(traceTime.getTime() + randomBetween(1000, 60000));
      traceData.push(generateTrace(project!.id, session!.id, traceTime));
    }

    await db.insert(traces).values(traceData);
    totalTraces += numTraces;

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`   Created ${i + 1}/${CONFIG.numSessions} sessions...`);
    }
  }

  console.log("");
  console.log("✅ Seed complete!");
  console.log(`   Sessions: ${CONFIG.numSessions}`);
  console.log(`   Traces: ${totalTraces}`);
  console.log("");
  console.log("🔑 Use this API key to query the data:");
  console.log(`   ${apiKey}`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
