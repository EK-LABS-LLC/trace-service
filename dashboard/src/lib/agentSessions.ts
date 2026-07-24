import type { ApiAgentSessionSummary } from "./apiClient";

export interface AgentSessionSummary {
  sessionId: string;
  displayName: string;
  subtitle: string;
  timestamp: string;
  status: "success" | "error";
  durationMs: number;
  totalSpans: number;
  traceCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  sources: string[];
  sourceLabel: string;
  cwd?: string;
  model?: string;
  shortId: string;
}

function pathBaseName(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const name = normalized.split("/").filter(Boolean).pop();
  return name || normalized || undefined;
}

function shortSessionId(sessionId: string): string {
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
    case "sdk":
      return "SDK";
    default:
      return source || "Agent";
  }
}

export function summarizeApiAgentSession(
  session: ApiAgentSessionSummary,
): AgentSessionSummary {
  const sources =
    session.sources.length > 0
      ? session.sources
      : session.source
        ? [session.source]
        : [];
  const sourceLabel = sources.map(formatAgentSource).join(" / ") || "Unknown";
  const shortId = shortSessionId(session.sessionId);
  const folderName = pathBaseName(session.cwd);
  const displayName = folderName
    ? `Session in ${folderName}`
    : session.agentName
      ? session.agentName
      : `Session ${shortId}`;
  const subtitleParts = [
    sourceLabel,
    folderName,
    session.model,
    shortId,
  ].filter(Boolean);

  return {
    sessionId: session.sessionId,
    displayName,
    subtitle: subtitleParts.join(" / "),
    timestamp: session.lastTimestamp,
    status: session.status,
    durationMs: session.durationMs,
    totalSpans: session.totalSpans,
    traceCount: session.traceCount,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    costCents: session.costCents,
    sources,
    sourceLabel,
    cwd: session.cwd,
    model: session.model,
    shortId,
  };
}
