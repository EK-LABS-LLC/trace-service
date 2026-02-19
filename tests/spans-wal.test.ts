import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { authFetch, createTestProject, cleanupTestData } from "./setup";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function readSpanWalFiles(): string[] {
  const segmentsDir = join(process.cwd(), ".data", "wal-spans", "segments");
  if (!existsSync(segmentsDir)) return [];

  const files = readdirSync(segmentsDir)
    .filter((file) => file.endsWith(".ndjson"))
    .sort();

  return files.map((file) => readFileSync(join(segmentsDir, file), "utf-8"));
}

async function waitForSpan(projectApiKey: string, spanId: string): Promise<Response> {
  for (let i = 0; i < 20; i++) {
    const response = await authFetch(`/v1/spans/${spanId}`, projectApiKey);
    if (response.status === 200) return response;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return authFetch(`/v1/spans/${spanId}`, projectApiKey);
}

describe("Span WAL service integration", () => {
  let testProject: { id: string; apiKey: string };

  beforeAll(async () => {
    testProject = await createTestProject("Span WAL Service Test");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test("async span write lands in span WAL files", async () => {
    const spanId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    const enqueueResponse = await authFetch("/v1/spans/async", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          span_id: spanId,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "tool_use",
          event_type: "post_tool_use",
          status: "success",
          tool_name: "Bash",
        },
      ]),
    });
    expect(enqueueResponse.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const walContents = readSpanWalFiles().join("\n");
    expect(walContents).toContain(spanId);
    expect(walContents).toContain(testProject.id);
  });

  test("async span write is processed from WAL into database", async () => {
    const spanId = crypto.randomUUID();

    const enqueueResponse = await authFetch("/v1/spans/async", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          span_id: spanId,
          session_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "agent_run",
          event_type: "subagent_stop",
          status: "success",
          agent_name: "Plan",
        },
      ]),
    });
    expect(enqueueResponse.status).toBe(202);

    const getResponse = await waitForSpan(testProject.apiKey, spanId);
    expect(getResponse.status).toBe(200);

    const span = (await getResponse.json()) as { spanId: string; kind: string };
    expect(span.spanId).toBe(spanId);
    expect(span.kind).toBe("agent_run");
  });

  test("batch async spans are visible in WAL and queryable via API", async () => {
    const sessionId = crypto.randomUUID();
    const spanIds = Array.from({ length: 6 }, () => crypto.randomUUID());

    const enqueueResponse = await authFetch("/v1/spans/async", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        spanIds.map((spanId, i) => ({
          span_id: spanId,
          session_id: sessionId,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          source: "claude_code",
          kind: i % 2 === 0 ? "tool_use" : "agent_run",
          event_type: i % 2 === 0 ? "post_tool_use" : "subagent_stop",
          status: "success",
          tool_name: i % 2 === 0 ? "Edit" : undefined,
        })),
      ),
    });
    expect(enqueueResponse.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const listResponse = await authFetch(
      `/v1/spans?session_id=${encodeURIComponent(sessionId)}&limit=100`,
      testProject.apiKey,
    );
    expect(listResponse.status).toBe(200);

    const data = (await listResponse.json()) as { spans: Array<{ spanId: string }> };
    const persistedIds = data.spans.map((s) => s.spanId);
    for (const spanId of spanIds) {
      expect(persistedIds).toContain(spanId);
    }

    const walContents = readSpanWalFiles().join("\n");
    for (const spanId of spanIds) {
      expect(walContents).toContain(spanId);
    }
  });
});
