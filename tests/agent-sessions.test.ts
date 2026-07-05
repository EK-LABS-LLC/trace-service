import { afterAll, describe, expect, test } from "bun:test";
import { authFetch, cleanupTestData, createTestProject, dashboardFetch } from "./setup";

type SpanPayload = {
  span_id: string;
  session_id: string;
  timestamp: string;
  source: "claude_code";
  kind: "session" | "tool_use" | "agent_run";
  event_type: string;
  status: "success" | "error";
  duration_ms?: number;
  tool_use_id?: string;
  tool_name?: string;
  cwd?: string;
  model?: string;
};

async function ingestSpans(apiKey: string, spans: SpanPayload[]): Promise<void> {
  for (let index = 0; index < spans.length; index += 100) {
    const response = await authFetch("/v1/spans/batch", apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spans.slice(index, index + 100)),
    });

    if (!response.ok) {
      throw new Error(`Failed to ingest spans: ${response.status} ${await response.text()}`);
    }
  }
}

function span(
  sessionId: string,
  timestamp: string,
  overrides: Partial<SpanPayload> = {}
): SpanPayload {
  return {
    span_id: crypto.randomUUID(),
    session_id: sessionId,
    timestamp,
    source: "claude_code",
    kind: "tool_use",
    event_type: "post_tool_use",
    status: "success",
    tool_name: "Bash",
    cwd: "/tmp/project",
    model: "gpt-5",
    ...overrides,
  };
}

async function getAgentSessions(
  projectId: string,
  query = ""
): Promise<{
  sessions: Array<{
    sessionId: string;
    totalSpans: number;
    toolCalls: number;
    errorCount: number;
    durationMs: number;
  }>;
  total: number;
}> {
  const response = await dashboardFetch(`/dashboard/api/agent-sessions${query}`, projectId);
  expect(response.status).toBe(200);
  return response.json();
}

describe("Dashboard agent sessions", () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  test("groups all matching spans before paginating agent sessions", async () => {
    const project = await createTestProject("Agent Sessions Large Test");
    const spans: SpanPayload[] = [];
    const sessionIds = Array.from({ length: 6 }, () => crypto.randomUUID());
    const base = new Date("2026-01-01T00:00:00.000Z").getTime();

    for (const [sessionIndex, sessionId] of sessionIds.entries()) {
      for (let spanIndex = 0; spanIndex < 110; spanIndex += 1) {
        spans.push(
          span(sessionId, new Date(base + sessionIndex * 60_000 + spanIndex * 1000).toISOString(), {
            tool_use_id: `${sessionId}-tool-${spanIndex}`,
          })
        );
      }
    }

    await ingestSpans(project.apiKey, spans);

    const data = await getAgentSessions(project.id, "?limit=10");
    expect(data.total).toBe(6);
    expect(data.sessions).toHaveLength(6);
    expect(data.sessions.every((session) => session.totalSpans === 110)).toBe(true);

    const detailResponse = await dashboardFetch(
      `/dashboard/api/sessions/${encodeURIComponent(sessionIds[0]!)}/spans`,
      project.id
    );
    const detail = (await detailResponse.json()) as { spans: unknown[] };
    expect(detailResponse.status).toBe(200);
    expect(detail.spans).toHaveLength(110);
  });

  test("filters span-only agent sessions by date range", async () => {
    const project = await createTestProject("Agent Sessions Date Test");
    const oldSessionId = crypto.randomUUID();
    const recentSessionId = crypto.randomUUID();

    await ingestSpans(project.apiKey, [
      span(oldSessionId, "2026-01-01T12:00:00.000Z"),
      span(recentSessionId, "2026-01-10T12:00:00.000Z"),
    ]);

    const data = await getAgentSessions(
      project.id,
      "?date_from=2026-01-08T00%3A00%3A00.000Z&date_to=2026-01-11T00%3A00%3A00.000Z"
    );

    expect(data.total).toBe(1);
    expect(data.sessions[0]?.sessionId).toBe(recentSessionId);
  });

  test("rejects invalid date-only filters", async () => {
    const project = await createTestProject("Agent Sessions Invalid Date Test");
    const response = await dashboardFetch(
      "/dashboard/api/agent-sessions?date_from=2026-02-30",
      project.id
    );

    expect(response.status).toBe(400);
  });

  test("sorts agent sessions and dedupes paired tool spans", async () => {
    const project = await createTestProject("Agent Sessions Sort Test");
    const oldestSession = crypto.randomUUID();
    const volumeSession = crypto.randomUUID();
    const errorDurationSession = crypto.randomUUID();

    await ingestSpans(project.apiKey, [
      span(oldestSession, "2026-01-01T00:00:00.000Z", {
        tool_use_id: "old-tool",
        event_type: "pre_tool_use",
      }),
      span(oldestSession, "2026-01-01T00:00:01.000Z", {
        tool_use_id: "old-tool",
        event_type: "post_tool_use",
      }),
      span(errorDurationSession, "2026-01-02T00:00:00.000Z", {
        kind: "session",
        event_type: "session_update",
        duration_ms: 5000,
        status: "error",
      }),
      span(volumeSession, "2026-01-03T00:00:00.000Z", { tool_use_id: "volume-1" }),
      span(volumeSession, "2026-01-03T00:00:01.000Z", { tool_use_id: "volume-2" }),
      span(volumeSession, "2026-01-03T00:00:02.000Z", { tool_use_id: "volume-3" }),
      span(volumeSession, "2026-01-03T00:00:03.000Z", { tool_use_id: "volume-4" }),
      span(volumeSession, "2026-01-03T00:00:04.000Z", { tool_use_id: "volume-5" }),
    ]);

    const recent = await getAgentSessions(project.id, "?sort=recent");
    expect(recent.sessions[0]?.sessionId).toBe(volumeSession);

    const oldest = await getAgentSessions(project.id, "?sort=oldest");
    expect(oldest.sessions[0]?.sessionId).toBe(oldestSession);

    const volume = await getAgentSessions(project.id, "?sort=volume");
    expect(volume.sessions[0]?.sessionId).toBe(volumeSession);

    const errors = await getAgentSessions(project.id, "?sort=errors");
    expect(errors.sessions[0]?.sessionId).toBe(errorDurationSession);

    const duration = await getAgentSessions(project.id, "?sort=duration");
    expect(duration.sessions[0]?.sessionId).toBe(errorDurationSession);

    const pairedToolSession = oldest.sessions.find(
      (session) => session.sessionId === oldestSession
    );
    expect(pairedToolSession?.toolCalls).toBe(1);
  });
});
