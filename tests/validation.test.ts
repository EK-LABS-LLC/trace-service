import { describe, expect, it } from "bun:test";
import {
  traceSchema,
  batchTraceSchema,
  providerSchema,
  statusSchema,
} from "../shared/validation";

/**
 * Helper to create a valid trace object for testing
 */
function createValidTrace(overrides: Record<string, unknown> = {}) {
  return {
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    timestamp: "2026-01-25T12:00:00.000Z",
    provider: "openai",
    model_requested: "gpt-4o",
    request_body: { messages: [{ role: "user", content: "Hello" }] },
    status: "success",
    latency_ms: 150,
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

describe("traceSchema", () => {
  describe("valid traces", () => {
    it("parses a minimal valid trace", () => {
      const trace = createValidTrace();
      const result = traceSchema.parse(trace);

      expect(result.trace_id).toBe(trace.trace_id);
      expect(result.timestamp).toBe(trace.timestamp);
      expect(result.provider).toBe(trace.provider);
      expect(result.model_requested).toBe(trace.model_requested);
      expect(result.status).toBe(trace.status);
      expect(result.latency_ms).toBe(trace.latency_ms);
    });

    it("parses a fully populated trace", () => {
      const trace = createValidTrace({
        model_used: "gpt-4o-2024-05-13",
        provider_request_id: "req-abc123",
        response_body: { choices: [{ message: { content: "Hi!" } }] },
        input_tokens: 10,
        output_tokens: 5,
        output_text: "Hi!",
        finish_reason: "stop",
        cost_cents: 0.05,
        session_id: "660e8400-e29b-41d4-a716-446655440001",
        metadata: { user_id: "user123", env: "production" },
      });

      const result = traceSchema.parse(trace);

      expect(result.model_used).toBe("gpt-4o-2024-05-13");
      expect(result.provider_request_id).toBe("req-abc123");
      expect(result.input_tokens).toBe(10);
      expect(result.output_tokens).toBe(5);
      expect(result.output_text).toBe("Hi!");
      expect(result.finish_reason).toBe("stop");
      expect(result.cost_cents).toBe(0.05);
      expect(result.session_id).toBe("660e8400-e29b-41d4-a716-446655440001");
      expect(result.metadata).toEqual({
        user_id: "user123",
        env: "production",
      });
    });

    it("parses a trace with error status and error object", () => {
      const trace = createValidTrace({
        status: "error",
        error: { name: "APIError", message: "Rate limit exceeded" },
      });

      const result = traceSchema.parse(trace);

      expect(result.status).toBe("error");
      expect(result.error).toEqual({
        name: "APIError",
        message: "Rate limit exceeded",
      });
    });

    it("accepts all valid provider values", () => {
      const providers = ["openai", "anthropic", "openrouter"] as const;

      for (const provider of providers) {
        const trace = createValidTrace({ provider });
        const result = traceSchema.parse(trace);
        expect(result.provider).toBe(provider);
      }
    });

    it("accepts timestamps with timezone offsets", () => {
      const trace = createValidTrace({
        timestamp: "2026-01-25T12:00:00+05:30",
      });
      const result = traceSchema.parse(trace);
      expect(result.timestamp).toBe("2026-01-25T12:00:00+05:30");
    });

    it("accepts zero latency", () => {
      const trace = createValidTrace({ latency_ms: 0 });
      const result = traceSchema.parse(trace);
      expect(result.latency_ms).toBe(0);
    });

    it("accepts zero tokens", () => {
      const trace = createValidTrace({
        input_tokens: 0,
        output_tokens: 0,
      });
      const result = traceSchema.parse(trace);
      expect(result.input_tokens).toBe(0);
      expect(result.output_tokens).toBe(0);
    });
  });

  describe("missing required fields", () => {
    it("fails when trace_id is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).trace_id;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when timestamp is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).timestamp;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when provider is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).provider;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when model_requested is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).model_requested;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when request_body is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).request_body;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when status is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).status;

      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when latency_ms is missing", () => {
      const trace = createValidTrace();
      delete (trace as Record<string, unknown>).latency_ms;

      expect(() => traceSchema.parse(trace)).toThrow();
    });
  });

  describe("invalid field values", () => {
    it("fails with invalid UUID for trace_id", () => {
      const trace = createValidTrace({ trace_id: "not-a-uuid" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with invalid timestamp format", () => {
      const trace = createValidTrace({ timestamp: "2026-01-25" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with invalid timestamp string", () => {
      const trace = createValidTrace({ timestamp: "not-a-timestamp" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with invalid provider enum value", () => {
      const trace = createValidTrace({ provider: "azure" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with empty model_requested", () => {
      const trace = createValidTrace({ model_requested: "" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with invalid status enum value", () => {
      const trace = createValidTrace({ status: "pending" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with negative latency_ms", () => {
      const trace = createValidTrace({ latency_ms: -100 });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with negative input_tokens", () => {
      const trace = createValidTrace({ input_tokens: -1 });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with negative output_tokens", () => {
      const trace = createValidTrace({ output_tokens: -1 });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with non-integer tokens", () => {
      const trace = createValidTrace({ input_tokens: 10.5 });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with negative cost_cents", () => {
      const trace = createValidTrace({ cost_cents: -0.01 });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails with invalid UUID for session_id", () => {
      const trace = createValidTrace({ session_id: "invalid-session" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when request_body is not an object", () => {
      const trace = createValidTrace({ request_body: "string" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when response_body is not an object", () => {
      const trace = createValidTrace({ response_body: ["array"] });
      expect(() => traceSchema.parse(trace)).toThrow();
    });

    it("fails when metadata is not an object", () => {
      const trace = createValidTrace({ metadata: "string" });
      expect(() => traceSchema.parse(trace)).toThrow();
    });
  });
});

describe("batchTraceSchema", () => {
  it("parses an empty array", () => {
    const result = batchTraceSchema.parse([]);
    expect(result).toEqual([]);
  });

  it("parses a single trace", () => {
    const traces = [createValidTrace()];
    const result = batchTraceSchema.parse(traces);
    expect(result).toHaveLength(1);
  });

  it("parses multiple valid traces", () => {
    const traces = [
      createValidTrace({ trace_id: "550e8400-e29b-41d4-a716-446655440001" }),
      createValidTrace({ trace_id: "550e8400-e29b-41d4-a716-446655440002" }),
      createValidTrace({ trace_id: "550e8400-e29b-41d4-a716-446655440003" }),
    ];
    const result = batchTraceSchema.parse(traces);
    expect(result).toHaveLength(3);
  });

  it("parses exactly 100 traces (max limit)", () => {
    const traces = Array.from({ length: 100 }, (_, i) =>
      createValidTrace({
        trace_id: `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, "0")}`,
      }),
    );
    const result = batchTraceSchema.parse(traces);
    expect(result).toHaveLength(100);
  });

  it("fails when batch exceeds 100 items", () => {
    const traces = Array.from({ length: 101 }, (_, i) =>
      createValidTrace({
        trace_id: `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, "0")}`,
      }),
    );
    expect(() => batchTraceSchema.parse(traces)).toThrow();
  });

  it("fails when any trace in batch is invalid", () => {
    const traces = [
      createValidTrace({ trace_id: "550e8400-e29b-41d4-a716-446655440001" }),
      createValidTrace({ trace_id: "not-a-uuid" }), // Invalid trace
      createValidTrace({ trace_id: "550e8400-e29b-41d4-a716-446655440003" }),
    ];
    expect(() => batchTraceSchema.parse(traces)).toThrow();
  });

  it("fails when input is not an array", () => {
    const notAnArray = { traces: [createValidTrace()] };
    expect(() => batchTraceSchema.parse(notAnArray)).toThrow();
  });
});
