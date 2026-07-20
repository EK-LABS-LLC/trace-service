import { describe, expect, test } from "bun:test";
import { extractOtlpSpans } from "./otlp";

function otlpPayload(spans: unknown[]) {
  return {
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans,
          },
        ],
      },
    ],
  };
}

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const SPAN_ID = "b7ad6b7169203331";
const PARENT_SPAN_ID = "00f067aa0ba902b7";

describe("extractOtlpSpans", () => {
  test("maps Pulse SDK OTLP attributes into validated span inputs", () => {
    const startNs = BigInt(Date.parse("2026-01-02T03:04:05.000Z")) * 1_000_000n;
    const endNs = startNs + 250_000_000n;

    const { spans, rejectedSpans } = extractOtlpSpans(
      otlpPayload([
        {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          parentSpanId: PARENT_SPAN_ID,
          name: "provider_call",
          startTimeUnixNano: startNs.toString(),
          endTimeUnixNano: endNs.toString(),
          attributes: [
            { key: "pulse.source", value: { stringValue: "sdk" } },
            { key: "pulse.kind", value: { stringValue: "llm_call" } },
            { key: "pulse.event_type", value: { stringValue: "provider_call" } },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
            { key: "pulse.provider", value: { stringValue: "openai" } },
            { key: "pulse.trace_id", value: { stringValue: TRACE_ID } },
            { key: "gen_ai.provider.name", value: { stringValue: "openai" } },
            { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
            { key: "gen_ai.response.model", value: { stringValue: "gpt-4o-2024-08-06" } },
            { key: "gen_ai.response.id", value: { stringValue: "chatcmpl-123" } },
            { key: "gen_ai.response.finish_reasons", value: { stringValue: '["stop"]' } },
            { key: "gen_ai.usage.input_tokens", value: { intValue: "42" } },
            { key: "gen_ai.usage.output_tokens", value: { intValue: "7" } },
            { key: "pulse.cost_cents", value: { doubleValue: 0.125 } },
            { key: "pulse.output_text", value: { stringValue: "Hello!" } },
          ],
          status: { code: 1 },
        },
      ]),
    );

    expect(rejectedSpans).toBe(0);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({
      span_id: SPAN_ID,
      trace_id: TRACE_ID,
      session_id: "session-1",
      parent_span_id: PARENT_SPAN_ID,
      source: "sdk",
      kind: "llm_call",
      event_type: "provider_call",
      status: "success",
      model: "gpt-4o",
      duration_ms: 250,
      provider: "openai",
      model_used: "gpt-4o-2024-08-06",
      provider_request_id: "chatcmpl-123",
      finish_reason: "stop",
      input_tokens: 42,
      output_tokens: 7,
      cost_cents: 0.125,
      output_text: "Hello!",
    });
  });

  test("does not duplicate first-class attributes into metadata", () => {
    const startNs = BigInt(Date.now()) * 1_000_000n;
    const { spans } = extractOtlpSpans(
      otlpPayload([
        {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          startTimeUnixNano: startNs.toString(),
          attributes: [
            { key: "pulse.source", value: { stringValue: "sdk" } },
            { key: "pulse.kind", value: { stringValue: "llm_call" } },
            { key: "pulse.event_type", value: { stringValue: "provider_call" } },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
            { key: "gen_ai.usage.input_tokens", value: { intValue: "42" } },
            { key: "pulse.provider", value: { stringValue: "openai" } },
            { key: "pulse.request", value: { stringValue: '{"model":"gpt-4o"}' } },
          ],
          status: { code: 1 },
        },
      ]),
    );

    const metadata = spans[0]!.metadata as Record<string, unknown>;
    expect(metadata["gen_ai.usage.input_tokens"]).toBeUndefined();
    expect(metadata["pulse.provider"]).toBeUndefined();
    expect(metadata["pulse.request"]).toEqual({ model: "gpt-4o" });
  });

  test("maps canonical CLI agent attributes and structured AnyValues", () => {
    const startNs = BigInt(Date.now()) * 1_000_000n;
    const { spans, rejectedSpans } = extractOtlpSpans(
      otlpPayload([
        {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          parentSpanId: PARENT_SPAN_ID,
          name: "agent.tool",
          startTimeUnixNano: startNs.toString(),
          endTimeUnixNano: startNs.toString(),
          attributes: [
            { key: "pulse.source", value: { stringValue: "codex" } },
            { key: "pulse.kind", value: { stringValue: "tool_use" } },
            {
              key: "pulse.event_type",
              value: { stringValue: "post_tool_use" },
            },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
            {
              key: "pulse.session_name",
              value: { stringValue: "Agent session" },
            },
            { key: "pulse.cwd", value: { stringValue: "/workspace" } },
            { key: "pulse.model", value: { stringValue: "gpt-5" } },
            { key: "pulse.is_interrupt", value: { boolValue: false } },
            { key: "pulse.agent.name", value: { stringValue: "explore" } },
            { key: "pulse.tool.id", value: { stringValue: "tool-1" } },
            { key: "pulse.tool.name", value: { stringValue: "shell" } },
            {
              key: "pulse.tool.input",
              value: {
                kvlistValue: {
                  values: [
                    { key: "command", value: { stringValue: "pwd" } },
                    {
                      key: "flags",
                      value: {
                        arrayValue: {
                          values: [
                            { stringValue: "-P" },
                            { stringValue: "--logical" },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
            {
              key: "pulse.tool.response",
              value: {
                kvlistValue: {
                  values: [
                    { key: "stdout", value: { stringValue: "/workspace" } },
                  ],
                },
              },
            },
            {
              key: "pulse.metadata",
              value: {
                kvlistValue: {
                  values: [
                    { key: "cli_version", value: { stringValue: "0.2.16" } },
                    { key: "project_id", value: { stringValue: "project-1" } },
                  ],
                },
              },
            },
          ],
          status: { code: 1 },
        },
      ]),
    );

    expect(rejectedSpans).toBe(0);
    expect(spans[0]).toMatchObject({
      session_id: "session-1",
      source: "codex",
      kind: "tool_use",
      event_type: "post_tool_use",
      status: "success",
      cwd: "/workspace",
      model: "gpt-5",
      is_interrupt: false,
      agent_name: "explore",
      tool_use_id: "tool-1",
      tool_name: "shell",
      tool_input: { command: "pwd", flags: ["-P", "--logical"] },
      tool_response: { stdout: "/workspace" },
      metadata: {
        cli_version: "0.2.16",
        project_id: "project-1",
        session_name: "Agent session",
      },
    });
  });

  test("counts invalid spans as rejected instead of failing the export", () => {
    const startNs = BigInt(Date.now()) * 1_000_000n;
    const { spans, rejectedSpans, errorMessage } = extractOtlpSpans(
      otlpPayload([
        {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          startTimeUnixNano: startNs.toString(),
          attributes: [
            { key: "pulse.source", value: { stringValue: "sdk" } },
            { key: "pulse.kind", value: { stringValue: "not_a_kind" } },
            { key: "pulse.event_type", value: { stringValue: "provider_call" } },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
          ],
        },
        {
          traceId: TRACE_ID,
          spanId: PARENT_SPAN_ID,
          startTimeUnixNano: startNs.toString(),
          attributes: [
            { key: "pulse.source", value: { stringValue: "sdk" } },
            { key: "pulse.kind", value: { stringValue: "llm_call" } },
            { key: "pulse.event_type", value: { stringValue: "provider_call" } },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
          ],
          status: { code: 1 },
        },
      ]),
    );

    expect(spans).toHaveLength(1);
    expect(rejectedSpans).toBe(1);
    expect(errorMessage).toBeTruthy();
  });

  test("does not reject a batch when one span has malformed timestamps", () => {
    const result = extractOtlpSpans(
      otlpPayload([
        {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          startTimeUnixNano: "1.2e9",
          endTimeUnixNano: "not-a-timestamp",
          attributes: [
            { key: "pulse.source", value: { stringValue: "sdk" } },
            { key: "pulse.kind", value: { stringValue: "llm_call" } },
            { key: "pulse.event_type", value: { stringValue: "provider_call" } },
            { key: "pulse.session_id", value: { stringValue: "session-1" } },
          ],
        },
      ]),
    );

    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]?.duration_ms).toBeUndefined();
  });

  test("throws when resourceSpans is missing", () => {
    expect(() => extractOtlpSpans({})).toThrow("Missing resourceSpans");
    expect(() => extractOtlpSpans(null)).toThrow("Missing resourceSpans");
  });

  test("skips null resource and scope entries", () => {
    expect(
      extractOtlpSpans({
        resourceSpans: [null, { scopeSpans: [null, { spans: [] }] }],
      }),
    ).toEqual({ spans: [], rejectedSpans: 0, errorMessage: undefined });
  });
});
