import type {
  AgentSessionQueryFilters,
  AgentSessionSummaryRow,
  StorageAdapter,
} from "../db/adapter";

export interface AgentSessionSummary {
  sessionId: string;
  firstTimestamp: string;
  lastTimestamp: string;
  status: "success" | "error";
  durationMs: number;
  agentRuns: number;
  toolCalls: number;
  totalSpans: number;
  errorCount: number;
  traceCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  sources: string[];
  source?: string;
  cwd?: string;
  model?: string;
  agentName?: string;
}

export interface QueryAgentSessionsResult {
  sessions: AgentSessionSummary[];
  total: number;
  limit: number;
  offset: number;
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  return new Date(0);
}

function toNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sourceList(value: string[] | string | null): string[] {
  const sources = Array.isArray(value) ? value : (value?.split(",") ?? []);
  return [
    ...new Set(sources.map((source) => source.trim()).filter(Boolean)),
  ].sort();
}

function mapRow(row: AgentSessionSummaryRow): AgentSessionSummary {
  const firstTimestamp = toDate(row.firstTimestamp);
  const lastTimestamp = toDate(row.lastTimestamp);
  const sessionDurationMs = row.sessionDurationMs;
  const inferredDurationMs = Math.max(
    0,
    lastTimestamp.getTime() - firstTimestamp.getTime(),
  );
  const sources = sourceList(row.sources);

  return {
    sessionId: row.sessionId,
    firstTimestamp: firstTimestamp.toISOString(),
    lastTimestamp: lastTimestamp.toISOString(),
    status: toNumber(row.errorCount) > 0 ? "error" : "success",
    durationMs:
      sessionDurationMs === null || sessionDurationMs === undefined
        ? inferredDurationMs
        : toNumber(sessionDurationMs),
    agentRuns: toNumber(row.agentRuns),
    toolCalls: toNumber(row.toolCalls),
    totalSpans: toNumber(row.totalSpans),
    errorCount: toNumber(row.errorCount),
    traceCount: toNumber(row.traceCount),
    inputTokens: toNumber(row.inputTokens),
    outputTokens: toNumber(row.outputTokens),
    costCents: toNumber(row.costCents),
    sources,
    source: sources.length === 1 ? sources[0] : undefined,
    cwd: optionalString(row.cwd),
    model: optionalString(row.model),
    agentName: optionalString(row.agentName),
  };
}

export async function queryAgentSessions(
  projectId: string,
  filters: AgentSessionQueryFilters,
  storage: StorageAdapter,
): Promise<QueryAgentSessionsResult> {
  const result = await storage.queryAgentSessions(projectId, filters);

  return {
    sessions: result.sessions.map(mapRow),
    total: toNumber(result.total),
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  };
}
