import { describe, expect, it } from "bun:test";
import {
  providerSchema,
  statusSchema,
  spanKindSchema,
  spanSchema,
  batchSpanSchema,
  MAX_OTLP_SPANS_PER_EXPORT,
  walSpanBatchSchema,
} from "../shared/validation";

function createValidSpan(overrides: Record<string, unknown> = {}) {
  return {
    span_id: "750e8400-e29b-41d4-a716-446655440000",
    session_id: "session-123",
    timestamp: "2026-01-25T12:00:00.000Z",
    source: "claude_code",
    kind: "user_prompt",
    event_type: "user_prompt_submit",
    status: "success",
    metadata: { prompt: "Hello" },
    ...overrides,
  };
}

describe("providerSchema", () => {
  it("accepts valid providers", () => {
    expect(providerSchema.parse("openai")).toBe("openai");
    expect(providerSchema.parse("anthropic")).toBe("anthropic");
    expect(providerSchema.parse("openrouter")).toBe("openrouter");
  });

  it("rejects invalid providers", () => {
    expect(() => providerSchema.parse("invalid")).toThrow();
    expect(() => providerSchema.parse("")).toThrow();
    expect(() => providerSchema.parse(123)).toThrow();
  });
});

describe("statusSchema", () => {
  it("accepts valid statuses", () => {
    expect(statusSchema.parse("success")).toBe("success");
    expect(statusSchema.parse("error")).toBe("error");
  });

  it("rejects invalid statuses", () => {
    expect(() => statusSchema.parse("pending")).toThrow();
    expect(() => statusSchema.parse("failed")).toThrow();
    expect(() => statusSchema.parse("")).toThrow();
  });
});

describe("spanKindSchema", () => {
  it("accepts valid span kinds", () => {
    expect(spanKindSchema.parse("tool_use")).toBe("tool_use");
    expect(spanKindSchema.parse("agent_run")).toBe("agent_run");
    expect(spanKindSchema.parse("session")).toBe("session");
    expect(spanKindSchema.parse("user_prompt")).toBe("user_prompt");
    expect(spanKindSchema.parse("llm_response")).toBe("llm_response");
    expect(spanKindSchema.parse("notification")).toBe("notification");
  });

  it("rejects invalid span kinds", () => {
    expect(() => spanKindSchema.parse("assistant_message")).toThrow();
    expect(() => spanKindSchema.parse("")).toThrow();
  });
});

describe("spanSchema", () => {
  it("accepts Codex as a span source", () => {
    const result = spanSchema.parse(createValidSpan({ source: "codex" }));

    expect(result.source).toBe("codex");
  });

  it("parses an llm_response span", () => {
    const span = createValidSpan({
      kind: "llm_response",
      event_type: "assistant_message",
      metadata: {
        content: "I updated the service schema.",
        usage: { input_tokens: 100, output_tokens: 42 },
      },
    });

    const result = spanSchema.parse(span);

    expect(result.kind).toBe("llm_response");
    expect(result.event_type).toBe("assistant_message");
    expect(result.metadata).toEqual({
      content: "I updated the service schema.",
      usage: { input_tokens: 100, output_tokens: 42 },
    });
  });
});

describe("span batch schemas", () => {
  it("keeps the public batch cap independent from the OTLP WAL cap", () => {
    expect(
      batchSpanSchema.safeParse(Array(101).fill(createValidSpan())).success,
    ).toBe(false);
    expect(
      walSpanBatchSchema.safeParse(
        Array(MAX_OTLP_SPANS_PER_EXPORT).fill(createValidSpan()),
      ).success,
    ).toBe(true);
    expect(
      walSpanBatchSchema.safeParse(
        Array(MAX_OTLP_SPANS_PER_EXPORT + 1).fill(createValidSpan()),
      ).success,
    ).toBe(false);
  });
});
