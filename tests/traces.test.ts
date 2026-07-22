import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  BASE_URL,
  authFetch,
  createTestProject,
  createTestTraces,
  cleanupTestData,
} from "./setup";

async function ingestSpans(
  apiKey: string,
  spans: Record<string, unknown>[],
): Promise<void> {
  const response = await authFetch("/v1/spans/batch", apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spans),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to ingest test spans (${response.status}): ${text}`,
    );
  }
}

interface Trace {
  traceId: string;
  provider: string;
  modelRequested: string;
  status: string;
  [key: string]: unknown;
}

interface TracesResponse {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
}

describe("Traces Endpoints", () => {
  let testProject: { id: string; apiKey: string };

  beforeAll(async () => {
    console.log("[traces.test] Setting up test project...");
    testProject = await createTestProject("Traces Test Project");
    console.log(`[traces.test] Created project: ${testProject.id}`);
  });

  afterAll(async () => {
    console.log("[traces.test] Cleaning up test data...");
    await cleanupTestData();
  });

  describe("GET /v1/traces", () => {
    test("filters by provider", async () => {
      const response = await authFetch(
        "/v1/traces?provider=openai",
        testProject.apiKey,
      );
      const data = (await response.json()) as TracesResponse;

      expect(response.status).toBe(200);
      data.traces.forEach((trace) => {
        expect(trace.provider).toBe("openai");
      });
    });

    test("returns 401 without auth", async () => {
      const response = await fetch(`${BASE_URL}/v1/traces`);

      expect(response.status).toBe(401);
    });

    test("returns 401 with invalid api key", async () => {
      const response = await authFetch("/v1/traces", "invalid-key");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/traces/:id", () => {
    test("returns a derived trace by id", async () => {
      const [traceId] = (await createTestTraces(testProject.id, 1)) as [string];
      const response = await authFetch(
        `/v1/traces/${traceId}`,
        testProject.apiKey,
      );
      const trace = (await response.json()) as Trace;

      expect(response.status).toBe(200);
      expect(trace.traceId).toBe(traceId);
      expect(trace.provider).toBe("openai");
    });

    test("returns 404 for non-existent trace", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await authFetch(
        `/v1/traces/${fakeId}`,
        testProject.apiKey,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/traces (span-derived, all sources)", () => {
    test("agent-source spans appear as traces", async () => {
      const agentProject = await createTestProject("Agent Traces Test Project");
      await ingestSpans(agentProject.apiKey, [
        {
          span_id: crypto.randomUUID(),
          trace_id: "trace-agent-1",
          session_id: "sess-1",
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "user_prompt",
          event_type: "user_prompt_submit",
          status: "success",
        },
        {
          span_id: crypto.randomUUID(),
          trace_id: "trace-agent-1",
          session_id: "sess-1",
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "tool_use",
          event_type: "post_tool_use",
          tool_use_id: "a",
          tool_name: "Bash",
          status: "success",
        },
      ]);

      const response = await authFetch("/v1/traces", agentProject.apiKey);
      const data = (await response.json()) as TracesResponse;

      expect(response.status).toBe(200);
      expect(data.traces.map((t) => t.traceId)).toContain("trace-agent-1");
    });

    test("session_start/session_end spans do not form a trace", async () => {
      const lifecycleProject = await createTestProject(
        "Lifecycle Traces Test Project",
      );
      await ingestSpans(lifecycleProject.apiKey, [
        {
          span_id: crypto.randomUUID(),
          trace_id: "lifecycle-1",
          session_id: "sess-2",
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "session",
          event_type: "session_start",
          status: "success",
        },
        {
          span_id: crypto.randomUUID(),
          trace_id: "lifecycle-1",
          session_id: "sess-2",
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "session",
          event_type: "session_end",
          status: "success",
        },
      ]);

      const response = await authFetch("/v1/traces", lifecycleProject.apiKey);
      const data = (await response.json()) as TracesResponse;

      expect(response.status).toBe(200);
      expect(data.traces.map((t) => t.traceId)).not.toContain("lifecycle-1");
    });

    test("source filter narrows trace list", async () => {
      const sourceFilterProject = await createTestProject(
        "Source Filter Traces Test Project",
      );
      await ingestSpans(sourceFilterProject.apiKey, [
        {
          span_id: "c1",
          trace_id: "tc",
          session_id: "s",
          timestamp: new Date().toISOString(),
          source: "claude_code",
          kind: "user_prompt",
          event_type: "user_prompt_submit",
          status: "success",
        },
        {
          span_id: "k1",
          trace_id: "tk",
          session_id: "s",
          timestamp: new Date().toISOString(),
          source: "sdk",
          kind: "llm_call",
          event_type: "provider_call",
          provider: "openai",
          model: "gpt-4o-mini",
          status: "success",
        },
      ]);

      const response = await authFetch(
        "/v1/traces?source=claude_code",
        sourceFilterProject.apiKey,
      );
      const data = (await response.json()) as TracesResponse;

      expect(response.status).toBe(200);
      const ids = data.traces.map((t) => t.traceId);
      expect(ids).toContain("tc");
      expect(ids).not.toContain("tk");
    });
  });
});
