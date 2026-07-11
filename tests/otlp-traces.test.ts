import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  authFetch,
  cleanupTestData,
  createTestProject,
  createTestTraces,
} from "./setup";

function otelTraceId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function otelSpanId(): string {
  return otelTraceId().slice(0, 16);
}

describe("OTLP / SDK traces", () => {
  let testProject: { id: string; apiKey: string };

  beforeAll(async () => {
    testProject = await createTestProject("OTLP Traces Test Project");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test("POST /v1/traces ingests OTLP spans and exposes derived traces", async () => {
    const sessionId = crypto.randomUUID();
    const traceId = otelTraceId();
    const spanId = otelSpanId();
    const startNs = BigInt(Date.now()) * 1_000_000n;

    const ingestResponse = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId,
                    spanId,
                    name: "provider_call",
                    startTimeUnixNano: startNs.toString(),
                    endTimeUnixNano: (startNs + 120_000_000n).toString(),
                    attributes: [
                      { key: "pulse.source", value: { stringValue: "sdk" } },
                      { key: "pulse.kind", value: { stringValue: "llm_call" } },
                      {
                        key: "pulse.event_type",
                        value: { stringValue: "provider_call" },
                      },
                      {
                        key: "pulse.session_id",
                        value: { stringValue: sessionId },
                      },
                      { key: "pulse.trace_id", value: { stringValue: traceId } },
                      {
                        key: "gen_ai.provider.name",
                        value: { stringValue: "openai" },
                      },
                      {
                        key: "gen_ai.request.model",
                        value: { stringValue: "gpt-4o-mini" },
                      },
                      {
                        key: "gen_ai.response.model",
                        value: { stringValue: "gpt-4o-mini-2024-07-18" },
                      },
                      {
                        key: "gen_ai.response.id",
                        value: { stringValue: "chatcmpl-abc" },
                      },
                      {
                        key: "gen_ai.response.finish_reasons",
                        value: { stringValue: '["stop"]' },
                      },
                      {
                        key: "gen_ai.usage.input_tokens",
                        value: { intValue: "120" },
                      },
                      {
                        key: "gen_ai.usage.output_tokens",
                        value: { intValue: "36" },
                      },
                      { key: "pulse.cost_cents", value: { doubleValue: 0.42 } },
                      { key: "pulse.output_text", value: { stringValue: "Hi there" } },
                    ],
                    status: { code: 1 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    // OTLP full success: 200 with an empty ExportTraceServiceResponse.
    expect(ingestResponse.status).toBe(200);
    const ingestData = (await ingestResponse.json()) as Record<string, unknown>;
    expect(ingestData.partialSuccess).toBeUndefined();

    const listResponse = await authFetch(
      `/v1/traces?session_id=${sessionId}`,
      testProject.apiKey,
    );
    const listData = (await listResponse.json()) as {
      traces: Array<{
        traceId: string;
        provider: string;
        inputTokens?: number;
        outputTokens?: number;
        costCents?: number;
        finishReason?: string;
        modelUsed?: string;
        providerRequestId?: string;
        outputText?: string;
        spans?: unknown[];
      }>;
      total: number;
    };
    expect(listResponse.status).toBe(200);
    expect(listData.total).toBe(1);
    expect(listData.traces[0]?.traceId).toBe(traceId);
    expect(listData.traces[0]?.provider).toBe("openai");
    expect(listData.traces[0]?.inputTokens).toBe(120);
    expect(listData.traces[0]?.outputTokens).toBe(36);
    expect(listData.traces[0]?.costCents).toBeCloseTo(0.42);
    expect(listData.traces[0]?.finishReason).toBe("stop");
    expect(listData.traces[0]?.modelUsed).toBe("gpt-4o-mini-2024-07-18");
    expect(listData.traces[0]?.providerRequestId).toBe("chatcmpl-abc");
    expect(listData.traces[0]?.outputText).toBe("Hi there");

    const detailResponse = await authFetch(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
    );
    const detail = (await detailResponse.json()) as {
      traceId: string;
      spans: Array<{ spanId: string }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detail.traceId).toBe(traceId);
    expect(detail.spans.some((span) => span.spanId === spanId)).toBe(true);

    const sessionResponse = await authFetch(
      `/v1/sessions/${sessionId}`,
      testProject.apiKey,
    );
    const sessionData = (await sessionResponse.json()) as {
      traces: Array<{ traceId: string }>;
    };
    expect(sessionResponse.status).toBe(200);
    expect(sessionData.traces.map((trace) => trace.traceId)).toEqual([traceId]);
  });

  test("POST /v1/traces is idempotent for retried exports", async () => {
    const sessionId = crypto.randomUUID();
    const traceId = otelTraceId();
    const spanId = otelSpanId();
    const startNs = BigInt(Date.now()) * 1_000_000n;
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId,
                  spanId,
                  name: "provider_call",
                  startTimeUnixNano: startNs.toString(),
                  endTimeUnixNano: (startNs + 80_000_000n).toString(),
                  attributes: [
                    { key: "pulse.source", value: { stringValue: "sdk" } },
                    { key: "pulse.kind", value: { stringValue: "llm_call" } },
                    { key: "pulse.event_type", value: { stringValue: "provider_call" } },
                    { key: "pulse.session_id", value: { stringValue: sessionId } },
                    { key: "pulse.trace_id", value: { stringValue: traceId } },
                    { key: "gen_ai.request.model", value: { stringValue: "gpt-4o-mini" } },
                  ],
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    const first = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(200);

    // An exporter retry of the same batch must succeed, not fail on duplicates.
    const retry = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(retry.status).toBe(200);

    const detailResponse = await authFetch(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
    );
    const detail = (await detailResponse.json()) as {
      spans: Array<{ spanId: string }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detail.spans.filter((span) => span.spanId === spanId)).toHaveLength(1);
  });

  test("GET /v1/traces merges SDK and legacy traces with correct offset", async () => {
    const project = await createTestProject("Merged Traces Pagination");
    const sessionId = crypto.randomUUID();
    await createTestTraces(project.id, 2, sessionId);

    const now = Date.now();
    const sdkTraceIds = [otelTraceId(), otelTraceId()];
    for (const [index, traceId] of sdkTraceIds.entries()) {
      const startNs = BigInt(now + (index + 10) * 60_000) * 1_000_000n;
      const response = await authFetch("/v1/traces", project.apiKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceSpans: [
            {
              scopeSpans: [
                {
                  spans: [
                    {
                      traceId,
                      spanId: otelSpanId(),
                      name: "provider_call",
                      startTimeUnixNano: startNs.toString(),
                      endTimeUnixNano: (startNs + 50_000_000n).toString(),
                      attributes: [
                        { key: "pulse.source", value: { stringValue: "sdk" } },
                        { key: "pulse.kind", value: { stringValue: "llm_call" } },
                        {
                          key: "pulse.event_type",
                          value: { stringValue: "provider_call" },
                        },
                        {
                          key: "pulse.session_id",
                          value: { stringValue: sessionId },
                        },
                        {
                          key: "pulse.trace_id",
                          value: { stringValue: traceId },
                        },
                        {
                          key: "gen_ai.provider.name",
                          value: { stringValue: "anthropic" },
                        },
                        {
                          key: "gen_ai.request.model",
                          value: { stringValue: "claude-sonnet" },
                        },
                      ],
                      status: { code: 1 },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });
      expect(response.status).toBe(200);
    }

    const page1 = await authFetch(
      `/v1/traces?session_id=${sessionId}&limit=2&offset=0`,
      project.apiKey,
    );
    const page1Data = (await page1.json()) as {
      traces: Array<{ traceId: string }>;
      total: number;
      limit: number;
      offset: number;
    };
    expect(page1.status).toBe(200);
    expect(page1Data.total).toBe(4);
    expect(page1Data.limit).toBe(2);
    expect(page1Data.offset).toBe(0);
    expect(page1Data.traces).toHaveLength(2);

    const page2 = await authFetch(
      `/v1/traces?session_id=${sessionId}&limit=2&offset=2`,
      project.apiKey,
    );
    const page2Data = (await page2.json()) as {
      traces: Array<{ traceId: string }>;
      total: number;
      offset: number;
    };
    expect(page2.status).toBe(200);
    expect(page2Data.total).toBe(4);
    expect(page2Data.offset).toBe(2);
    expect(page2Data.traces).toHaveLength(2);

    const allIds = new Set([
      ...page1Data.traces.map((trace) => trace.traceId),
      ...page2Data.traces.map((trace) => trace.traceId),
    ]);
    expect(allIds.size).toBe(4);
  });

  test("POST /v1/traces reports invalid spans via partialSuccess", async () => {
    const response = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: otelTraceId(),
                    spanId: otelSpanId(),
                    startTimeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
                    attributes: [
                      { key: "pulse.source", value: { stringValue: "sdk" } },
                      { key: "pulse.kind", value: { stringValue: "bad_kind" } },
                      {
                        key: "pulse.event_type",
                        value: { stringValue: "provider_call" },
                      },
                      {
                        key: "pulse.session_id",
                        value: { stringValue: crypto.randomUUID() },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      partialSuccess?: { rejectedSpans: number; errorMessage: string };
    };
    expect(data.partialSuccess?.rejectedSpans).toBe(1);
    expect(data.partialSuccess?.errorMessage).toBeTruthy();
  });

  test("POST /v1/traces rejects malformed payloads", async () => {
    const response = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notResourceSpans: [] }),
    });
    expect(response.status).toBe(400);
  });
});
