import { test, expect } from "bun:test";
import { deriveTraceSummary } from "../services/derived-traces";
import type { Span } from "../db/schema";

function span(overrides: Partial<Span>): Span {
  return {
    spanId: crypto.randomUUID(),
    traceId: "t1",
    projectId: "p1",
    sessionId: "s1",
    parentSpanId: null,
    timestamp: new Date("2026-07-20T00:00:00Z"),
    durationMs: 0,
    source: "claude_code",
    kind: "tool_use",
    eventType: "post_tool_use",
    status: "success",
    toolUseId: null,
    toolName: null,
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
    metadata: null,
    ...overrides,
  } as Span;
}

test("agent turn summarises tool calls and files edited", () => {
  const spans = [
    span({
      kind: "user_prompt",
      eventType: "user_prompt_submit",
      durationMs: 10,
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "a",
      toolName: "Edit",
      toolInput: { file_path: "/x.ts" },
      durationMs: 5,
    }),
    span({
      kind: "tool_use",
      eventType: "pre_tool_use",
      toolUseId: "a",
      toolName: "Edit",
      toolInput: { file_path: "/x.ts" },
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "b",
      toolName: "Write",
      toolInput: { file_path: "/y.ts" },
      durationMs: 5,
    }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "c",
      toolName: "Bash",
      durationMs: 5,
    }),
  ];
  const s = deriveTraceSummary("t1", spans);
  expect(s.source).toBe("claude_code");
  expect(s.toolCallCount).toBe(3); // distinct tool_use_id a,b,c
  expect(s.filesEdited).toBe(2); // /x.ts, /y.ts
  expect(s.summary).toBe("3 tool calls · 2 files edited");
  expect(s.provider).toBeNull();
  expect(s.spanCount).toBe(5);
});

test("agent turn with no edit tools falls back to tool count", () => {
  const spans = [
    span({ kind: "user_prompt", eventType: "user_prompt_submit" }),
    span({
      kind: "tool_use",
      eventType: "post_tool_use",
      toolUseId: "a",
      toolName: "Bash",
    }),
  ];
  expect(deriveTraceSummary("t1", spans).summary).toBe("1 tool calls");
});

test("sdk trace keeps llm fields and models the summary", () => {
  const spans = [
    span({
      source: "sdk",
      kind: "llm_call",
      eventType: "provider_call",
      provider: "openai",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 20,
      costCents: 3,
      durationMs: 800,
    }),
  ];
  const s = deriveTraceSummary("t1", spans);
  expect(s.source).toBe("sdk");
  expect(s.provider).toBe("openai");
  expect(s.inputTokens).toBe(100);
  expect(s.summary).toBe("gpt-4o-mini");
});
