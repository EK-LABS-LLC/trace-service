import { describe, test, expect, afterAll } from "bun:test";
import {
  authFetch,
  cleanupTestData,
  createTestProject,
  dashboardFetch,
} from "./setup";

type TestProject = { id: string; apiKey: string };

interface TraceSummary {
  traceId: string;
  sessionId: string;
  name: string;
  source: string;
  status: string;
  spanCount: number;
  errorCount: number;
  inputTokens: number;
  outputTokens: number;
  attributes?: Record<string, unknown>;
}

interface SpanRow {
  spanId: string;
  traceId: string;
  sessionId: string;
  source: string;
  kind: string;
  eventType?: string;
  name?: string;
  parentSpanId?: string | null;
  attributes?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  scope?: Record<string, unknown>;
}

function unixNano(iso: string): string {
  return `${BigInt(new Date(iso).getTime()) * 1_000_000n}`;
}

function otelTraceId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

function otelSpanId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

function stringAttr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function intAttr(key: string, value: number) {
  return { key, value: { intValue: value } };
}

async function ingestOtlp(project: TestProject, payload: unknown) {
  return authFetch("/v1/traces", project.apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function otlpPayload(options: {
  traceId: string;
  sessionId: string;
  startIso: string;
  source?: string;
  spans: Array<{
    spanId: string;
    parentSpanId?: string;
    name: string;
    startOffsetMs?: number;
    durationMs: number;
    statusCode?: number | string;
    attributes?: Array<{ key: string; value: Record<string, unknown> }>;
  }>;
}) {
  const startMs = new Date(options.startIso).getTime();
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            stringAttr("service.name", "pulse-otel-test"),
            stringAttr("deployment.environment", "test"),
          ],
        },
        scopeSpans: [
          {
            scope: { name: "pulse-test-suite", version: "0.0.0" },
            spans: options.spans.map((span) => {
              const spanStartMs = startMs + (span.startOffsetMs ?? 0);
              return {
                traceId: options.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: 1,
                startTimeUnixNano: unixNano(new Date(spanStartMs).toISOString()),
                endTimeUnixNano: unixNano(
                  new Date(spanStartMs + span.durationMs).toISOString(),
                ),
                attributes: [
                  stringAttr("pulse.session_id", options.sessionId),
                  stringAttr("pulse.source", options.source ?? "otel_test"),
                  stringAttr("pulse.kind", "otel"),
                  stringAttr("pulse.event_type", span.name),
                  ...(span.attributes ?? []),
                ],
                events: [{ name: `${span.name}.event` }],
                links: [],
                status: {
                  code: span.statusCode ?? 1,
                  message: span.statusCode === 2 ? "failed" : "ok",
                },
              };
            }),
          },
        ],
      },
    ],
  };
}

describe("Experimental OTel trace model", () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  test("OTLP JSON ingest stores spans and preserves OTel fields", async () => {
    const project = await createTestProject("OTel JSON Ingest Test");
    const sessionId = crypto.randomUUID();
    const traceId = otelTraceId();
    const rootSpanId = otelSpanId();
    const childSpanId = otelSpanId();

    const ingestResponse = await ingestOtlp(
      project,
      otlpPayload({
        traceId,
        sessionId,
        startIso: "2026-01-05T10:00:00.000Z",
        spans: [
          {
            spanId: rootSpanId,
            name: "agent.turn",
            durationMs: 300,
            attributes: [
              intAttr("gen_ai.usage.input_tokens", 12),
              intAttr("gen_ai.usage.output_tokens", 24),
            ],
          },
          {
            spanId: childSpanId,
            parentSpanId: rootSpanId,
            name: "tool.call",
            startOffsetMs: 50,
            durationMs: 100,
          },
        ],
      }),
    );
    const ingestData = (await ingestResponse.json()) as { count: number; traceCount: number };

    expect(ingestResponse.status).toBe(202);
    expect(ingestData.count).toBe(2);
    expect(ingestData.traceCount).toBe(1);

    const tracesResponse = await dashboardFetch(
      `/dashboard/api/otel/sessions/${sessionId}/traces`,
      project.id,
    );
    const tracesData = (await tracesResponse.json()) as {
      traces: TraceSummary[];
      total: number;
    };

    expect(tracesResponse.status).toBe(200);
    expect(tracesData.total).toBe(1);
    expect(tracesData.traces[0]?.traceId).toBe(traceId);
    expect(tracesData.traces[0]?.spanCount).toBe(2);
    expect(tracesData.traces[0]?.inputTokens).toBe(12);
    expect(tracesData.traces[0]?.outputTokens).toBe(24);

    const spansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${traceId}/spans`,
      project.id,
    );
    const spansData = (await spansResponse.json()) as { spans: SpanRow[]; total: number };

    expect(spansResponse.status).toBe(200);
    expect(spansData.total).toBe(2);
    expect(spansData.spans[0]?.spanId).toBe(rootSpanId);
    expect(spansData.spans[0]?.resource?.["service.name"]).toBe("pulse-otel-test");
    expect(spansData.spans[0]?.scope?.name).toBe("pulse-test-suite");
    expect(spansData.spans[1]?.parentSpanId).toBe(rootSpanId);
    expect(spansData.spans[1]?.attributes?.["pulse.session_id"]).toBe(sessionId);
  });

  test("OTLP ingest accepts dotted Pulse attribute names from SDK and CLI clients", async () => {
    const project = await createTestProject("OTel Dotted Attribute Compatibility Test");
    const sessionId = crypto.randomUUID();
    const traceId = otelTraceId();
    const rootSpanId = otelSpanId();

    const ingestResponse = await ingestOtlp(
      project,
      otlpPayload({
        traceId,
        sessionId,
        startIso: "2026-01-06T10:00:00.000Z",
        source: "unused-source",
        spans: [
          {
            spanId: rootSpanId,
            name: "agent.tool",
            durationMs: 100,
            statusCode: "STATUS_CODE_ERROR",
            attributes: [
              stringAttr("pulse.session.id", sessionId),
              stringAttr("pulse.source", "codex"),
              stringAttr("pulse.event.kind", "tool_use"),
              stringAttr("pulse.event.type", "post_tool_use"),
              stringAttr("gen_ai.system", "openai"),
              stringAttr("gen_ai.request.model", "gpt-4o"),
              intAttr("pulse.cost.cents", 3),
            ],
          },
        ],
      }),
    );

    expect(ingestResponse.status).toBe(202);

    const tracesResponse = await dashboardFetch(
      `/dashboard/api/otel/sessions/${sessionId}/traces`,
      project.id,
    );
    const tracesData = (await tracesResponse.json()) as {
      traces: TraceSummary[];
      total: number;
    };

    expect(tracesResponse.status).toBe(200);
    expect(tracesData.total).toBe(1);
    expect(tracesData.traces[0]?.source).toBe("codex");
    expect(tracesData.traces[0]?.status).toBe("error");
    expect(tracesData.traces[0]?.errorCount).toBe(1);
    expect(tracesData.traces[0]?.costCents).toBe(3);
    expect(tracesData.traces[0]?.attributes?.["gen_ai.provider.name"]).toBe("openai");

    const spansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${traceId}/spans`,
      project.id,
    );
    const spansData = (await spansResponse.json()) as { spans: SpanRow[]; total: number };

    expect(spansResponse.status).toBe(200);
    expect(spansData.total).toBe(1);
    expect(spansData.spans[0]?.sessionId).toBe(sessionId);
    expect(spansData.spans[0]?.source).toBe("codex");
    expect(spansData.spans[0]?.kind).toBe("tool_use");
    expect(spansData.spans[0]?.eventType).toBe("post_tool_use");
  });

  test("legacy SDK trace payload creates one trace summary and one provider span", async () => {
    const project = await createTestProject("Legacy SDK Trace Adapter Test");
    const sessionId = crypto.randomUUID();
    const legacyTraceId = crypto.randomUUID();
    const otelId = legacyTraceId.replaceAll("-", "");

    const ingestResponse = await authFetch("/v1/traces/batch", project.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          trace_id: legacyTraceId,
          session_id: sessionId,
          timestamp: "2026-02-01T12:00:00.000Z",
          provider: "openai",
          model_requested: "gpt-4o",
          latency_ms: 250,
          status: "success",
          request_body: { model: "gpt-4o", messages: [] },
          input_tokens: 10,
          output_tokens: 20,
          cost_cents: 0.4,
        },
      ]),
    });

    expect(ingestResponse.status).toBe(202);

    const tracesResponse = await dashboardFetch(
      `/dashboard/api/otel/sessions/${sessionId}/traces`,
      project.id,
    );
    const tracesData = (await tracesResponse.json()) as {
      traces: TraceSummary[];
      total: number;
    };

    expect(tracesResponse.status).toBe(200);
    expect(tracesData.total).toBe(1);
    expect(tracesData.traces[0]?.traceId).toBe(otelId);
    expect(tracesData.traces[0]?.source).toBe("sdk");
    expect(tracesData.traces[0]?.spanCount).toBe(1);

    const spansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${otelId}/spans`,
      project.id,
    );
    const spansData = (await spansResponse.json()) as { spans: SpanRow[]; total: number };

    expect(spansResponse.status).toBe(200);
    expect(spansData.total).toBe(1);
    expect(spansData.spans[0]?.source).toBe("sdk");
    expect(spansData.spans[0]?.kind).toBe("llm_call");
    expect(spansData.spans[0]?.attributes?.["gen_ai.provider.name"]).toBe("openai");
  });

  test("legacy trace reads are served from OTel summaries", async () => {
    const project = await createTestProject("Legacy Trace Read Adapter Test");
    const sessionId = crypto.randomUUID();
    const traceId = otelTraceId();

    const ingestResponse = await ingestOtlp(
      project,
      otlpPayload({
        traceId,
        sessionId,
        startIso: "2026-02-01T12:00:00.000Z",
        source: "sdk",
        spans: [
          {
            spanId: otelSpanId(),
            name: "openai.chat.completions",
            durationMs: 250,
            attributes: [
              stringAttr("gen_ai.provider.name", "openai"),
              stringAttr("gen_ai.request.model", "gpt-4o"),
              intAttr("gen_ai.usage.input_tokens", 8),
              intAttr("gen_ai.usage.output_tokens", 13),
            ],
          },
        ],
      }),
    );
    expect(ingestResponse.status).toBe(202);

    const listResponse = await authFetch(
      `/v1/traces?session_id=${sessionId}&provider=openai`,
      project.apiKey,
    );
    const listData = (await listResponse.json()) as {
      traces: Array<{
        traceId: string;
        provider: string;
        modelRequested: string;
        inputTokens: number;
        outputTokens: number;
      }>;
      total: number;
    };

    expect(listResponse.status).toBe(200);
    expect(listData.total).toBe(1);
    expect(listData.traces[0]?.traceId).toBe(traceId);
    expect(listData.traces[0]?.provider).toBe("openai");
    expect(listData.traces[0]?.modelRequested).toBe("gpt-4o");
    expect(listData.traces[0]?.inputTokens).toBe(8);
    expect(listData.traces[0]?.outputTokens).toBe(13);

    const detailResponse = await authFetch(`/v1/traces/${traceId}`, project.apiKey);
    const detailData = (await detailResponse.json()) as {
      traceId: string;
      provider: string;
      metadata?: { otelTraceId?: string; spanCount?: number };
    };

    expect(detailResponse.status).toBe(200);
    expect(detailData.traceId).toBe(traceId);
    expect(detailData.provider).toBe("openai");
    expect(detailData.metadata?.otelTraceId).toBe(traceId);
    expect(detailData.metadata?.spanCount).toBe(1);
  });

  test("OTel backfill command is idempotent for legacy trace rows", async () => {
    const project = await createTestProject("OTel Backfill Idempotency Test");
    const sessionId = crypto.randomUUID();
    const legacyTraceId = crypto.randomUUID();
    const otelId = legacyTraceId.replaceAll("-", "");

    const ingestResponse = await authFetch("/v1/traces/batch", project.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          trace_id: legacyTraceId,
          session_id: sessionId,
          timestamp: "2026-02-04T12:00:00.000Z",
          provider: "openai",
          model_requested: "gpt-4o",
          latency_ms: 100,
          status: "success",
          request_body: { model: "gpt-4o", messages: [] },
          input_tokens: 1,
          output_tokens: 2,
        },
      ]),
    });
    expect(ingestResponse.status).toBe(202);

    for (let i = 0; i < 2; i += 1) {
      const proc = Bun.spawn(["bun", "run", "db:backfill:otel"], {
        cwd: process.cwd(),
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      expect(exitCode, stderr).toBe(0);
    }

    const spansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${otelId}/spans`,
      project.id,
    );
    const spansData = (await spansResponse.json()) as { total: number };

    expect(spansResponse.status).toBe(200);
    expect(spansData.total).toBe(1);
  });

  test("trace summaries prefer explicit trace names and prompt previews over model fallback", async () => {
    const project = await createTestProject("OTel Trace Display Name Test");
    const sessionId = crypto.randomUUID();
    const legacyTraceId = crypto.randomUUID();
    const otelId = legacyTraceId.replaceAll("-", "");

    const ingestResponse = await authFetch("/v1/traces/batch", project.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          trace_id: legacyTraceId,
          session_id: sessionId,
          timestamp: "2026-02-03T12:00:00.000Z",
          provider: "openai",
          model_requested: "gpt-4o",
          latency_ms: 250,
          status: "success",
          request_body: {
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: "Investigate why checkout refunds are failing for enterprise users.",
              },
            ],
          },
          input_tokens: 10,
          output_tokens: 20,
          metadata: {
            "pulse.session.name": "Checkout refund investigation",
            "pulse.trace.name": "Diagnose refund failure",
          },
        },
      ]),
    });

    expect(ingestResponse.status).toBe(202);

    const traceResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${otelId}`,
      project.id,
    );
    const traceData = (await traceResponse.json()) as TraceSummary;

    expect(traceResponse.status).toBe(200);
    expect(traceData.name).toBe("Diagnose refund failure");
    expect(traceData.attributes?.["pulse.session.name"]).toBe("Checkout refund investigation");
    expect(traceData.attributes?.["pulse.prompt.preview"]).toBe(
      "Investigate why checkout refunds are failing for enterprise users.",
    );
    expect(traceData.attributes?.["gen_ai.provider.name"]).toBe("openai");
    expect(traceData.attributes?.["gen_ai.request.model"]).toBe("gpt-4o");
  });

  test("legacy SDK trace payload without session_id still creates an OTel summary", async () => {
    const project = await createTestProject("Legacy SDK Trace Without Session Test");
    const legacyTraceId = crypto.randomUUID();
    const otelId = legacyTraceId.replaceAll("-", "");

    const ingestResponse = await authFetch("/v1/traces/batch", project.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          trace_id: legacyTraceId,
          timestamp: "2026-02-02T12:00:00.000Z",
          provider: "anthropic",
          model_requested: "claude-3-5-sonnet",
          latency_ms: 300,
          status: "success",
          request_body: { model: "claude-3-5-sonnet", messages: [] },
          input_tokens: 11,
          output_tokens: 22,
        },
      ]),
    });

    expect(ingestResponse.status).toBe(202);

    const traceResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${otelId}`,
      project.id,
    );
    const traceData = (await traceResponse.json()) as TraceSummary;
    expect(traceResponse.status).toBe(200);
    expect(traceData.traceId).toBe(otelId);
    expect(traceData.sessionId).toBe(legacyTraceId);
    expect(traceData.source).toBe("sdk");

    const spansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${otelId}/spans`,
      project.id,
    );
    const spansData = (await spansResponse.json()) as { spans: SpanRow[]; total: number };
    expect(spansResponse.status).toBe(200);
    expect(spansData.total).toBe(1);
    expect(spansData.spans[0]?.sessionId).toBe(legacyTraceId);
    expect(spansData.spans[0]?.attributes?.["pulse.session_id"]).toBe(legacyTraceId);
  });

  test("legacy agent spans without trace_id group into one user-turn trace", async () => {
    const project = await createTestProject("Legacy Agent Span Adapter Test");
    const sessionId = crypto.randomUUID();
    const spans = [
      {
        span_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: "2026-03-01T09:00:00.000Z",
        source: "claude_code",
        kind: "user_prompt",
        event_type: "user_prompt_submit",
        status: "success",
        metadata: { prompt: "summarize this repo" },
      },
      {
        span_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: "2026-03-01T09:00:02.000Z",
        source: "claude_code",
        kind: "llm_response",
        event_type: "assistant_message",
        status: "success",
      },
      {
        span_id: crypto.randomUUID(),
        session_id: sessionId,
        timestamp: "2026-03-01T09:00:05.000Z",
        duration_ms: 125,
        source: "claude_code",
        kind: "tool_use",
        event_type: "post_tool_use",
        status: "error",
        tool_name: "Bash",
      },
    ];

    const ingestResponse = await authFetch("/v1/spans/batch", project.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spans),
    });

    expect(ingestResponse.status).toBe(202);

    const tracesResponse = await dashboardFetch(
      `/dashboard/api/otel/sessions/${sessionId}/traces`,
      project.id,
    );
    const tracesData = (await tracesResponse.json()) as {
      traces: TraceSummary[];
      total: number;
    };

    expect(tracesResponse.status).toBe(200);
    expect(tracesData.total).toBe(1);
    expect(tracesData.traces[0]?.source).toBe("claude_code");
    expect(tracesData.traces[0]?.name).toBe("summarize this repo");
    expect(tracesData.traces[0]?.status).toBe("error");
    expect(tracesData.traces[0]?.spanCount).toBe(3);
    expect(tracesData.traces[0]?.errorCount).toBe(1);
    expect(tracesData.traces[0]?.attributes?.["pulse.tool_call_count"]).toBe(1);

    const traceId = tracesData.traces[0]!.traceId;
    const traceSpansResponse = await dashboardFetch(
      `/dashboard/api/otel/traces/${traceId}/spans`,
      project.id,
    );
    const traceSpansData = (await traceSpansResponse.json()) as {
      spans: SpanRow[];
      total: number;
    };

    expect(traceSpansResponse.status).toBe(200);
    expect(traceSpansData.total).toBe(3);
    expect(traceSpansData.spans.map((span) => span.spanId)).toEqual(
      spans.map((span) => span.span_id),
    );
  });

  test("session summaries filter by date and sort by duration, errors, and volume", async () => {
    const project = await createTestProject("OTel Dashboard Query Test");
    const slowSessionId = crypto.randomUUID();
    const busySessionId = crypto.randomUUID();
    const slowTraceId = otelTraceId();
    const busyTraceId = otelTraceId();
    const busyRootSpanId = otelSpanId();

    const slowPayload = otlpPayload({
      traceId: slowTraceId,
      sessionId: slowSessionId,
      startIso: "2026-04-02T00:00:00.000Z",
      spans: [
        {
          spanId: otelSpanId(),
          name: "slow.error",
          durationMs: 1_000,
          statusCode: 2,
        },
      ],
    });
    const busyPayload = otlpPayload({
      traceId: busyTraceId,
      sessionId: busySessionId,
      startIso: "2026-04-01T00:00:00.000Z",
      spans: [
        {
          spanId: busyRootSpanId,
          name: "busy.root",
          durationMs: 100,
        },
        {
          spanId: otelSpanId(),
          parentSpanId: busyRootSpanId,
          name: "busy.child.1",
          startOffsetMs: 10,
          durationMs: 30,
        },
        {
          spanId: otelSpanId(),
          parentSpanId: busyRootSpanId,
          name: "busy.child.2",
          startOffsetMs: 40,
          durationMs: 30,
        },
      ],
    });

    expect((await ingestOtlp(project, slowPayload)).status).toBe(202);
    expect((await ingestOtlp(project, busyPayload)).status).toBe(202);
    expect((await ingestOtlp(project, busyPayload)).status).toBe(202);

    const inRangeResponse = await dashboardFetch(
      "/dashboard/api/otel/sessions?date_from=2026-04-01&date_to=2026-04-30",
      project.id,
    );
    const inRangeData = (await inRangeResponse.json()) as {
      sessions: Array<{ sessionId: string; spanCount: number; errorCount: number }>;
      total: number;
    };
    expect(inRangeResponse.status).toBe(200);
    expect(inRangeData.total).toBe(2);

    const outOfRangeResponse = await dashboardFetch(
      "/dashboard/api/otel/sessions?date_from=2026-05-01&date_to=2026-05-31",
      project.id,
    );
    const outOfRangeData = (await outOfRangeResponse.json()) as { total: number };
    expect(outOfRangeResponse.status).toBe(200);
    expect(outOfRangeData.total).toBe(0);

    const volumeResponse = await dashboardFetch(
      "/dashboard/api/otel/sessions?date_from=2026-04-01&date_to=2026-04-30&sort=volume",
      project.id,
    );
    const volumeData = (await volumeResponse.json()) as {
      sessions: Array<{ sessionId: string; spanCount: number }>;
    };
    expect(volumeData.sessions[0]?.sessionId).toBe(busySessionId);
    expect(volumeData.sessions[0]?.spanCount).toBe(3);

    const durationResponse = await dashboardFetch(
      "/dashboard/api/otel/sessions?date_from=2026-04-01&date_to=2026-04-30&sort=duration",
      project.id,
    );
    const durationData = (await durationResponse.json()) as {
      sessions: Array<{ sessionId: string }>;
    };
    expect(durationData.sessions[0]?.sessionId).toBe(slowSessionId);

    const errorsResponse = await dashboardFetch(
      "/dashboard/api/otel/sessions?date_from=2026-04-01&date_to=2026-04-30&sort=errors",
      project.id,
    );
    const errorsData = (await errorsResponse.json()) as {
      sessions: Array<{ sessionId: string; errorCount: number }>;
    };
    expect(errorsData.sessions[0]?.sessionId).toBe(slowSessionId);
    expect(errorsData.sessions[0]?.errorCount).toBe(1);
  });
});
