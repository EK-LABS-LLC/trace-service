import { useState } from "react";
import type { Trace, Span } from "../lib/apiClient";
import SessionsTable from "../components/sessions/SessionsTable";
import AgentSessionsTable from "../components/sessions/AgentSessionsTable";
import type { SessionSummary } from "../components/sessions/SessionsTable";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { useTracesQuery, useSpansQuery } from "../api";
import { useProject } from "../hooks/useProject";

type ViewTab = "llm" | "agents";

interface AgentSessionSummary {
  sessionId: string;
  timestamp: string;
  status: "success" | "error";
  durationMs: number;
  agentRuns: number;
  toolCalls: number;
}

const CalendarIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-3.5 h-3.5 text-neutral-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

function groupTracesIntoSessions(traces: Trace[]): SessionSummary[] {
  const sessionMap = new Map<string, Trace[]>();

  for (const trace of traces) {
    if (!trace.sessionId) continue;
    const existing = sessionMap.get(trace.sessionId) || [];
    existing.push(trace);
    sessionMap.set(trace.sessionId, existing);
  }

  const sessions: SessionSummary[] = [];
  for (const [session_id, sessionTraces] of sessionMap) {
    const sorted = sessionTraces.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const totalTokens = sorted.reduce(
      (sum, t) => sum + (t.inputTokens || 0) + (t.outputTokens || 0),
      0,
    );
    const totalCost = sorted.reduce((sum, t) => sum + (t.costCents || 0), 0);
    const errorCount = sorted.filter((t) => t.status === "error").length;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;

    sessions.push({
      session_id,
      first_trace_time: first.timestamp,
      last_trace_time: last.timestamp,
      trace_count: sorted.length,
      total_tokens: totalTokens,
      total_cost_cents: totalCost,
      error_count: errorCount,
      user: first.metadata?.user as string | undefined,
    });
  }

  return sessions.sort(
    (a, b) =>
      new Date(b.first_trace_time).getTime() -
      new Date(a.first_trace_time).getTime(),
  );
}

function groupSpansIntoSessions(spans: Span[]): AgentSessionSummary[] {
  const sessionMap = new Map<string, Span[]>();

  for (const span of spans) {
    if (!span.sessionId) continue;
    const existing = sessionMap.get(span.sessionId) || [];
    existing.push(span);
    sessionMap.set(span.sessionId, existing);
  }

  const sessions: AgentSessionSummary[] = [];
  for (const [sessionId, sessionSpans] of sessionMap) {
    const sorted = sessionSpans.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const agentRuns = sorted.filter((s) => s.kind === "agent_run").length;
    const toolCalls = sorted.filter((s) => s.kind === "tool_use").length;
    const errorCount = sorted.filter((s) => s.status === "error").length;

    // Get duration from session span or calculate from first/last
    const sessionSpan = sorted.find((s) => s.kind === "session");
    const durationMs = sessionSpan?.durationMs ?? 0;

    const first = sorted[0];
    if (!first) continue;

    sessions.push({
      sessionId,
      timestamp: first.timestamp,
      status: errorCount > 0 ? "error" : "success",
      durationMs,
      agentRuns,
      toolCalls,
    });
  }

  return sessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export default function Sessions() {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState<ViewTab>("llm");
  const [searchQuery, setSearchQuery] = useState("");

  // LLM sessions (from traces)
  const sessionsQuery = useTracesQuery(
    "sessions-source-traces",
    selectedProject?.id,
    {
      limit: 500,
    },
  );

  // Agent sessions (from spans)
  const spansQuery = useSpansQuery(
    "sessions-source-spans",
    selectedProject?.id,
    {
      limit: 500,
    },
  );

  const llmSessions = groupTracesIntoSessions(sessionsQuery.data?.traces ?? []);
  const agentSessions = groupSpansIntoSessions(spansQuery.data?.spans ?? []);

  const llmLoading = sessionsQuery.isPending;
  const agentLoading = spansQuery.isPending;
  const llmError =
    sessionsQuery.error instanceof Error ? sessionsQuery.error.message : null;
  const agentError =
    spansQuery.error instanceof Error ? spansQuery.error.message : null;

  const filteredLlmSessions = searchQuery
    ? llmSessions.filter(
        (s) =>
          s.session_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.user && s.user.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : llmSessions;

  const filteredAgentSessions = searchQuery
    ? agentSessions.filter((s) =>
        s.sessionId.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : agentSessions;

  const total = activeTab === "llm" ? llmSessions.length : agentSessions.length;
  const error = activeTab === "llm" ? llmError : agentError;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">Sessions</h1>
          {/* Tab Switcher */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-sm p-0.5">
            <button
              onClick={() => setActiveTab("llm")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                activeTab === "llm"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              LLM
            </button>
            <button
              onClick={() => setActiveTab("agents")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                activeTab === "agents"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Agents
            </button>
          </div>
          <span className="text-xs text-neutral-500">
            {total.toLocaleString()} total
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-300 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors">
            <CalendarIcon />
            <span>Last 7 days</span>
            <ChevronDownIcon />
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-neutral-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Live
          </div>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by session ID or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-neutral-300 placeholder:text-neutral-500 outline-none"
              />
            </div>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-400 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            Sort: Recent
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded">
            <div className="flex items-center justify-between gap-4">
              <p className="text-rose-400 text-sm">{error}</p>
              <button
                onClick={() => {
                  if (activeTab === "llm") sessionsQuery.refetch();
                  else spansQuery.refetch();
                }}
                className="text-sm text-accent hover:underline whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {activeTab === "llm" && (
          <>
            {llmLoading ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                  <TableSkeleton rows={10} columns={7} />
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <SessionsTable sessions={filteredLlmSessions} />
              </div>
            )}
          </>
        )}

        {activeTab === "agents" && (
          <>
            {agentLoading ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
                  <TableSkeleton rows={10} columns={6} />
                </div>
              </div>
            ) : filteredAgentSessions.length === 0 ? (
              <div className="max-w-5xl mx-auto">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-neutral-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-neutral-300 mb-2">
                    No Agent Sessions
                  </h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Agent sessions with span data will appear here when
                    available.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <AgentSessionsTable sessions={filteredAgentSessions} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
