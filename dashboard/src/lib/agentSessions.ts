import type { Span } from "./apiClient";

export interface AgentSessionSummary {
  sessionId: string;
  displayName: string;
  subtitle: string;
  timestamp: string;
  status: "success" | "error";
  durationMs: number;
  agentRuns: number;
  toolCalls: number;
  totalSpans: number;
  source?: string;
  sourceLabel: string;
  cwd?: string;
  model?: string;
  firstPrompt?: string;
  shortId: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const result = stringValue(value);
    if (result) return result;
  }
  return undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function pathBaseName(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const name = normalized.split("/").filter(Boolean).pop();
  return name || normalized || undefined;
}

export function shortSessionId(sessionId: string): string {
  if (sessionId.length <= 16) return sessionId;
  return `${sessionId.slice(0, 8)}...${sessionId.slice(-4)}`;
}

export function formatAgentSource(source: string | undefined): string {
  switch (source) {
    case "claude_code":
      return "Claude Code";
    case "opencode":
      return "OpenCode";
    case "openclaw":
      return "OpenClaw";
    case "codex":
      return "Codex";
    default:
      return source || "Agent";
  }
}

function spanRaw(span: Span): Record<string, unknown> | undefined {
  return asRecord(span.metadata?.raw);
}

function spanPrompt(span: Span): string | undefined {
  const raw = spanRaw(span);
  return firstString(
    span.metadata?.prompt,
    raw?.prompt,
    span.metadata?.user_prompt,
    raw?.user_prompt,
    span.toolInput
  );
}

function spanTitle(span: Span): string | undefined {
  const raw = spanRaw(span);
  return firstString(
    span.metadata?.title,
    span.metadata?.session_title,
    raw?.title,
    raw?.session_title,
    raw?.conversation_title
  );
}

function spanCwd(span: Span): string | undefined {
  const raw = spanRaw(span);
  return firstString(span.cwd, raw?.cwd, span.metadata?.cwd);
}

function spanModel(span: Span): string | undefined {
  const raw = spanRaw(span);
  return firstString(span.model, raw?.model, span.metadata?.model);
}

export function summarizeAgentSession(
  sessionId: string,
  spans: Span[]
): AgentSessionSummary | null {
  const sorted = [...spans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const first = sorted[0];
  if (!first) return null;

  const agentRuns = sorted.filter((span) => span.kind === "agent_run").length;
  const toolCalls = sorted.filter((span) => span.kind === "tool_use").length;
  const errorCount = sorted.filter((span) => span.status === "error").length;
  const sessionSpan = sorted.find((span) => span.kind === "session");

  const source = firstString(...sorted.map((span) => span.source));
  const sourceLabel = formatAgentSource(source);
  const title = firstString(...sorted.map(spanTitle));
  const firstPrompt = firstString(...sorted.map(spanPrompt));
  const cwd = firstString(...sorted.map(spanCwd));
  const model = firstString(...sorted.map(spanModel));
  const shortId = shortSessionId(sessionId);
  const folderName = pathBaseName(cwd);

  const displayName =
    title ||
    (firstPrompt ? truncate(firstPrompt, 88) : undefined) ||
    (folderName ? `${sourceLabel} in ${folderName}` : undefined) ||
    `${sourceLabel} ${shortId}`;

  const subtitleParts = [sourceLabel, folderName, model, shortId].filter(Boolean);

  return {
    sessionId,
    displayName,
    subtitle: subtitleParts.join(" / "),
    timestamp: first.timestamp,
    status: errorCount > 0 ? "error" : "success",
    durationMs: sessionSpan?.durationMs ?? 0,
    agentRuns,
    toolCalls,
    totalSpans: sorted.length,
    source,
    sourceLabel,
    cwd,
    model,
    firstPrompt,
    shortId,
  };
}

export function groupSpansIntoAgentSessions(spans: Span[]): AgentSessionSummary[] {
  const sessionMap = new Map<string, Span[]>();

  for (const span of spans) {
    if (!span.sessionId) continue;
    const existing = sessionMap.get(span.sessionId) || [];
    existing.push(span);
    sessionMap.set(span.sessionId, existing);
  }

  const sessions: AgentSessionSummary[] = [];
  for (const [sessionId, sessionSpans] of sessionMap) {
    const session = summarizeAgentSession(sessionId, sessionSpans);
    if (session) sessions.push(session);
  }

  return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
