import { describe, expect, test } from "bun:test";
import {
  deriveTraceSummary,
  mergeTracePages,
} from "./sdk-traces";

describe("sdk-traces", () => {
  test("deriveTraceSummary prefers llm_call span and aggregates tool calls", () => {
    const summary = deriveTraceSummary("trace-1", [
      {
        spanId: "tool-1",
        traceId: "trace-1",
        projectId: "p1",
        sessionId: "session-1",
        parentSpanId: "llm-1",
        timestamp: new Date("2026-01-01T00:00:01.000Z"),
        durationMs: 10,
        source: "sdk",
        kind: "tool_use",
        eventType: "tool_request",
        status: "success",
        toolUseId: "call-1",
        toolName: "Bash",
        toolInput: null,
        toolResponse: null,
        error: null,
        isInterrupt: null,
        cwd: null,
        model: null,
        agentName: null,
        provider: null,
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        costCents: null,
        finishReason: null,
        outputText: null,
        providerRequestId: null,
        metadata: {},
      },
      {
        spanId: "llm-1",
        traceId: "trace-1",
        projectId: "p1",
        sessionId: "session-1",
        parentSpanId: null,
        timestamp: new Date("2026-01-01T00:00:00.000Z"),
        durationMs: 100,
        source: "sdk",
        kind: "llm_call",
        eventType: "provider_call",
        status: "success",
        toolUseId: null,
        toolName: null,
        toolInput: null,
        toolResponse: null,
        error: null,
        isInterrupt: null,
        cwd: null,
        model: "gpt-4o",
        agentName: null,
        provider: "openai",
        modelUsed: "gpt-4o-2024-08-06",
        inputTokens: 120,
        outputTokens: 36,
        costCents: 0.42,
        finishReason: "stop",
        outputText: "Hi there",
        providerRequestId: "chatcmpl-123",
        metadata: {
          "pulse.provider": "openai",
          "pulse.request": { model: "gpt-4o" },
          "pulse.response": { id: "resp" },
        },
      },
    ]);

    expect(summary.provider).toBe("openai");
    expect(summary.modelRequested).toBe("gpt-4o");
    expect(summary.modelUsed).toBe("gpt-4o-2024-08-06");
    expect(summary.inputTokens).toBe(120);
    expect(summary.outputTokens).toBe(36);
    expect(summary.costCents).toBe(0.42);
    expect(summary.finishReason).toBe("stop");
    expect(summary.outputText).toBe("Hi there");
    expect(summary.providerRequestId).toBe("chatcmpl-123");
    expect(summary.latencyMs).toBe(110);
    expect(summary.metadata.toolCalls).toBe(1);
    expect(summary.spans).toHaveLength(2);
    expect(summary.spans[0]?.spanId).toBe("llm-1");
  });

  test("mergeTracePages sorts descending and applies offset/limit", () => {
    const page = mergeTracePages(
      [
        { traceId: "sdk-new", timestamp: "2026-01-01T00:00:03.000Z" },
        { traceId: "sdk-old", timestamp: "2026-01-01T00:00:01.000Z" },
      ],
      [
        { traceId: "legacy-mid", timestamp: "2026-01-01T00:00:02.000Z" },
        { traceId: "legacy-oldest", timestamp: "2026-01-01T00:00:00.000Z" },
      ],
      { limit: 2, offset: 1 },
    );

    expect(page.total).toBe(4);
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(1);
    expect(page.traces.map((trace) => trace.traceId)).toEqual([
      "legacy-mid",
      "sdk-old",
    ]);
  });
});
