import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  authFetch,
  cleanupTestData,
  createTestProject,
  createTestTraces,
} from "./setup";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveDataPaths } from "../lib/data-paths";

function spanWalDir(): string {
  return process.env.WAL_SPAN_DIR ?? resolveDataPaths(process.env).walSpanDir;
}

function readSpanWalFiles(): string[] {
  const segmentsDir = join(spanWalDir(), "segments");
  if (!existsSync(segmentsDir)) return [];

  return readdirSync(segmentsDir)
    .filter((file) => file.endsWith(".ndjson"))
    .sort()
    .map((file) => readFileSync(join(segmentsDir, file), "utf-8"));
}

interface SpanWalRecord {
  sequence: number;
  payload?: {
    projectId?: string;
    spans?: Array<{ span_id?: string }>;
  };
}

function readSpanWalRecords(): SpanWalRecord[] {
  return readSpanWalFiles().flatMap((contents) =>
    contents
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as SpanWalRecord];
        } catch {
          // The server may still be appending the final line while we poll.
          return [];
        }
      }),
  );
}

function spanWalSequences(spanId: string): number[] {
  return readSpanWalRecords().flatMap((record) =>
    record.payload?.spans?.some((span) => span.span_id === spanId)
      ? [record.sequence]
      : [],
  );
}

async function waitForSpanWalExport(
  projectId: string,
  spanIds: string[],
): Promise<SpanWalRecord | undefined> {
  const expectedIds = new Set(spanIds);
  for (let i = 0; i < 40; i++) {
    const record = readSpanWalRecords().find((candidate) => {
      const spans = candidate.payload?.spans ?? [];
      return (
        candidate.payload?.projectId === projectId &&
        spans.length === expectedIds.size &&
        spans.every(
          (span) => span.span_id !== undefined && expectedIds.has(span.span_id),
        )
      );
    });
    if (record) return record;
    await Bun.sleep(100);
  }

  return undefined;
}

async function waitForSpanWalContents(spanIds: string[]): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const walContents = readSpanWalFiles().join("\n");
    if (spanIds.every((spanId) => walContents.includes(spanId))) {
      return walContents;
    }
    await Bun.sleep(100);
  }

  return readSpanWalFiles().join("\n");
}

async function waitForSpanWalRecords(
  spanId: string,
  count: number,
): Promise<number[]> {
  for (let i = 0; i < 30; i++) {
    const sequences = spanWalSequences(spanId);
    if (sequences.length >= count) return sequences;
    await Bun.sleep(100);
  }

  return spanWalSequences(spanId);
}

async function waitForSpanWalCheckpoint(sequence: number): Promise<boolean> {
  const checkpointPath = join(spanWalDir(), "wal.checkpoint");
  for (let i = 0; i < 40; i++) {
    if (existsSync(checkpointPath)) {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf-8")) as {
        nextSequence: string;
      };
      if (Number(checkpoint.nextSequence) > sequence) return true;
    }
    await Bun.sleep(100);
  }

  return false;
}

async function waitForApiResponse(
  path: string,
  apiKey: string,
  predicate: (data: unknown) => boolean,
  attempts = 40,
): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    const response = await authFetch(path, apiKey);
    if (response.status === 200 && predicate(await response.clone().json())) {
      return response;
    }
    await Bun.sleep(100);
  }

  return authFetch(path, apiKey);
}

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
                      {
                        key: "pulse.trace_id",
                        value: { stringValue: traceId },
                      },
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
                      {
                        key: "pulse.output_text",
                        value: { stringValue: "Hi there" },
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

    // OTLP full success: 200 with an empty ExportTraceServiceResponse.
    expect(ingestResponse.status).toBe(200);
    const ingestData = (await ingestResponse.json()) as Record<string, unknown>;
    expect(ingestData.partialSuccess).toBeUndefined();

    const walContents = await waitForSpanWalContents([spanId]);
    expect(walContents).toContain(spanId);
    expect(walContents).toContain(testProject.id);

    const listResponse = await waitForApiResponse(
      `/v1/traces?session_id=${sessionId}`,
      testProject.apiKey,
      (data) => (data as { total?: number }).total === 1,
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

    const detailResponse = await waitForApiResponse(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
      (data) =>
        (data as { spans?: Array<{ spanId: string }> }).spans?.some(
          (span) => span.spanId === spanId,
        ) === true,
    );
    const detail = (await detailResponse.json()) as {
      traceId: string;
      spans: Array<{ spanId: string }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detail.traceId).toBe(traceId);
    expect(detail.spans.some((span) => span.spanId === spanId)).toBe(true);

    const sessionResponse = await waitForApiResponse(
      `/v1/sessions/${sessionId}`,
      testProject.apiKey,
      (data) =>
        (data as { traces?: Array<{ traceId: string }> }).traces?.some(
          (trace) => trace.traceId === traceId,
        ) === true,
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
                      key: "gen_ai.request.model",
                      value: { stringValue: "gpt-4o-mini" },
                    },
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

    const duplicateSequences = await waitForSpanWalRecords(spanId, 2);
    expect(duplicateSequences).toHaveLength(2);
    expect(
      await waitForSpanWalCheckpoint(Math.max(...duplicateSequences)),
    ).toBe(true);

    const detailResponse = await waitForApiResponse(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
      (data) =>
        (data as { spans?: Array<{ spanId: string }> }).spans?.filter(
          (span) => span.spanId === spanId,
        ).length === 1,
    );
    const detail = (await detailResponse.json()) as {
      spans: Array<{ spanId: string }>;
    };
    expect(detailResponse.status).toBe(200);
    expect(detail.spans.filter((span) => span.spanId === spanId)).toHaveLength(
      1,
    );
  });

  test("POST /v1/traces persists all 101 spans from one OTLP export", async () => {
    const traceId = otelTraceId();
    const sessionId = crypto.randomUUID();
    const spanIds = Array.from({ length: 101 }, () => otelSpanId());
    const expectedSpanIds = new Set(spanIds);
    const startNs = BigInt(Date.now()) * 1_000_000n;
    expect(expectedSpanIds.size).toBe(101);

    const response = await authFetch("/v1/traces", testProject.apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: spanIds.map((spanId, index) => {
                  const spanStartNs = startNs + BigInt(index) * 1_000_000n;
                  return {
                    traceId,
                    spanId,
                    name: `provider_call_${index}`,
                    startTimeUnixNano: spanStartNs.toString(),
                    endTimeUnixNano: (spanStartNs + 1_000_000n).toString(),
                    attributes: [
                      { key: "pulse.source", value: { stringValue: "sdk" } },
                      {
                        key: "pulse.kind",
                        value: { stringValue: "llm_call" },
                      },
                      {
                        key: "pulse.event_type",
                        value: { stringValue: "provider_call" },
                      },
                      {
                        key: "pulse.session_id",
                        value: { stringValue: sessionId },
                      },
                    ],
                    status: { code: 1 },
                  };
                }),
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});

    const walRecord = await waitForSpanWalExport(testProject.id, spanIds);
    expect(walRecord).toBeDefined();
    const walSpanIds = walRecord?.payload?.spans?.map((span) => span.span_id);
    expect(walSpanIds).toHaveLength(101);
    expect(new Set(walSpanIds)).toEqual(expectedSpanIds);

    const detailResponse = await waitForApiResponse(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
      (data) => {
        const spans = (data as { spans?: Array<{ spanId: string }> }).spans;
        if (spans?.length !== 101) return false;
        const persistedIds = new Set(spans.map((span) => span.spanId));
        return (
          persistedIds.size === 101 &&
          spanIds.every((spanId) => persistedIds.has(spanId))
        );
      },
      100,
    );
    const detail = (await detailResponse.json()) as {
      spans: Array<{ spanId: string }>;
    };
    const persistedIds = new Set(detail.spans.map((span) => span.spanId));

    expect(detailResponse.status).toBe(200);
    expect(detail.spans).toHaveLength(101);
    expect(persistedIds).toEqual(expectedSpanIds);
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
                        {
                          key: "pulse.kind",
                          value: { stringValue: "llm_call" },
                        },
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

    const page1 = await waitForApiResponse(
      `/v1/traces?session_id=${sessionId}&limit=2&offset=0`,
      project.apiKey,
      (data) => (data as { total?: number }).total === 4,
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

  test("POST /v1/traces queues valid spans and reports validation rejects", async () => {
    const validSpanId = otelSpanId();
    const invalidSpanId = otelSpanId();
    const traceId = otelTraceId();
    const sessionId = crypto.randomUUID();
    const startNs = BigInt(Date.now()) * 1_000_000n;
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
                    traceId,
                    spanId: validSpanId,
                    startTimeUnixNano: startNs.toString(),
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
                    ],
                  },
                  {
                    traceId,
                    spanId: invalidSpanId,
                    startTimeUnixNano: startNs.toString(),
                    attributes: [
                      { key: "pulse.source", value: { stringValue: "sdk" } },
                      { key: "pulse.kind", value: { stringValue: "bad_kind" } },
                      {
                        key: "pulse.event_type",
                        value: { stringValue: "provider_call" },
                      },
                      {
                        key: "pulse.session_id",
                        value: { stringValue: sessionId },
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

    const walContents = await waitForSpanWalContents([validSpanId]);
    expect(walContents).toContain(validSpanId);
    expect(walContents).not.toContain(invalidSpanId);

    const detailResponse = await waitForApiResponse(
      `/v1/traces/${traceId}`,
      testProject.apiKey,
      (detail) =>
        (detail as { spans?: Array<{ spanId: string }> }).spans?.some(
          (span) => span.spanId === validSpanId,
        ) === true,
    );
    expect(detailResponse.status).toBe(200);
  });

  test("POST /v1/traces does not append an event when all spans are rejected", async () => {
    const rejectedProject = await createTestProject(
      "OTLP All Rejected Test Project",
    );
    const response = await authFetch("/v1/traces", rejectedProject.apiKey, {
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
                    attributes: [
                      { key: "pulse.kind", value: { stringValue: "bad_kind" } },
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
      partialSuccess?: { rejectedSpans: number };
    };
    expect(data.partialSuccess?.rejectedSpans).toBe(1);
    expect(readSpanWalFiles().join("\n")).not.toContain(rejectedProject.id);
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
