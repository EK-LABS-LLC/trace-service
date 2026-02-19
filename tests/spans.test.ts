import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  authFetch,
  createTestProject,
  cleanupTestData,
} from "./setup";

describe("Spans Endpoints", () => {
  let testProject: { id: string; apiKey: string };
  let sessionId: string;
  let spanIds: string[];

  beforeAll(async () => {
    testProject = await createTestProject("Spans Test Project");
    sessionId = crypto.randomUUID();

    const seedSpans = Array.from({ length: 6 }, (_, i) => ({
      span_id: crypto.randomUUID(),
      session_id: sessionId,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      source: "claude_code" as const,
      kind: i % 2 === 0 ? ("tool_use" as const) : ("agent_run" as const),
      event_type: i % 2 === 0 ? "post_tool_use" : "subagent_stop",
      status: i === 0 ? ("error" as const) : ("success" as const),
      tool_name: i % 2 === 0 ? "Bash" : undefined,
      duration_ms: 100 + i,
      metadata: { i },
    }));

    const ingestResponse = await authFetch("/v1/spans/batch", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seedSpans),
    });
    expect(ingestResponse.status).toBe(202);
    spanIds = seedSpans.map((s) => s.span_id);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test("GET /v1/spans returns spans for authenticated project", async () => {
    const response = await authFetch("/v1/spans", testProject.apiKey);
    const data = (await response.json()) as {
      spans: Array<Record<string, unknown>>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(data.total).toBeGreaterThanOrEqual(6);
    expect(data.spans.length).toBeGreaterThan(0);
  });

  test("GET /v1/spans filters by kind", async () => {
    const response = await authFetch(
      "/v1/spans?kind=tool_use",
      testProject.apiKey,
    );
    const data = (await response.json()) as {
      spans: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    data.spans.forEach((span) => {
      expect(span.kind).toBe("tool_use");
    });
  });

  test("GET /v1/spans/:id returns single span", async () => {
    const firstSpanId = spanIds[0]!;
    const response = await authFetch(
      `/v1/spans/${firstSpanId}`,
      testProject.apiKey,
    );
    const data = (await response.json()) as { spanId: string };

    expect(response.status).toBe(200);
    expect(data.spanId).toBe(firstSpanId);
  });

  test("POST /v1/spans/async queues and persists span", async () => {
    const payload = [
      {
        span_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        source: "claude_code",
        kind: "tool_use",
        event_type: "post_tool_use",
        status: "success",
        tool_name: "Read",
      },
    ];
    const payloadSpanId = payload[0]!.span_id;

    const enqueueResponse = await authFetch("/v1/spans/async", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(enqueueResponse.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await authFetch(
      `/v1/spans?session_id=${encodeURIComponent(sessionId)}&limit=100`,
      testProject.apiKey,
    );
    const data = (await response.json()) as {
      spans: Array<{ spanId: string }>;
    };

    expect(data.spans.some((span) => span.spanId === payloadSpanId)).toBe(true);
  });
});
