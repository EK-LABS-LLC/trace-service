import { useState } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import type { Trace, Span } from "../lib/apiClient";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useSessionDetailQuery, useSessionSpansQuery } from "../api";
import { useProject } from "../hooks/useProject";

const BackIcon = () => (
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
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

const CopyIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const ExternalLinkIcon = () => (
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
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms}ms`;
}

interface SessionStats {
  traceCount: number;
  totalTokens: number;
  totalCost: number;
  duration: string;
  errorCount: number;
}

function calculateSessionStats(traces: Trace[]): SessionStats {
  const sorted = [...traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const totalTokens = sorted.reduce(
    (sum, t) => sum + (t.inputTokens || 0) + (t.outputTokens || 0),
    0,
  );
  const totalCost = sorted.reduce((sum, t) => sum + (t.costCents || 0), 0);
  const errorCount = sorted.filter((t) => t.status === "error").length;
  const duration =
    sorted.length >= 2
      ? formatDuration(sorted[0].timestamp, sorted[sorted.length - 1].timestamp)
      : "0s";

  return {
    traceCount: sorted.length,
    totalTokens,
    totalCost,
    duration,
    errorCount,
  };
}

interface CopyButtonProps {
  text: string;
  className?: string;
}

function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-neutral-300 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

interface TraceCardProps {
  trace: Trace;
  isLatest: boolean;
  onClick: () => void;
}

function TraceCard({ trace, isLatest, onClick }: TraceCardProps) {
  const isError = trace.status === "error";

  return (
    <div
      onClick={onClick}
      className={`bg-neutral-900 border rounded-lg p-3 hover:bg-neutral-850 cursor-pointer transition-colors ${
        isLatest ? "border-accent/30" : "border-neutral-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isError ? "bg-error" : "bg-success"}`}
          ></span>
          <span className="text-xs font-mono text-neutral-300">
            {trace.traceId.slice(0, 8)}
          </span>
          {isLatest && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
              Latest
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-500">
          {formatTime(trace.timestamp)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">
            {trace.modelUsed || trace.modelRequested}
          </span>
        </div>
        <div className="flex items-center gap-3 text-neutral-500">
          <span>
            {formatTokens((trace.inputTokens || 0) + (trace.outputTokens || 0))}{" "}
            tok
          </span>
          <span>{formatLatency(trace.latencyMs)}</span>
          <span>{formatCost(trace.costCents)}</span>
        </div>
      </div>
    </div>
  );
}

export default function SessionDetail() {
  const { selectedProject } = useProject();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");

  const isAgentView = view === "agents";

  // Fetch traces for LLM view
  const sessionQuery = useSessionDetailQuery(
    selectedProject?.id,
    isAgentView ? undefined : id,
  );
  // Fetch spans for Agent view
  const spansQuery = useSessionSpansQuery(
    "session-spans",
    selectedProject?.id,
    isAgentView ? id : undefined,
  );

  const session = !isAgentView ? (sessionQuery.data ?? null) : null;
  const spansData = isAgentView ? (spansQuery.data ?? null) : null;

  const loading = isAgentView ? spansQuery.isPending : sessionQuery.isPending;
  const error = isAgentView
    ? spansQuery.error instanceof Error
      ? spansQuery.error.message
      : null
    : sessionQuery.error instanceof Error
      ? sessionQuery.error.message
      : null;

  // Agent view rendering
  if (isAgentView) {
    return (
      <AgentSessionDetail
        sessionId={id || ""}
        spans={spansData?.spans ?? []}
        loading={loading}
        error={error}
        onRetry={() => spansQuery.refetch()}
        onBack={() => navigate("/dashboard/sessions?tab=agents")}
      />
    );
  }

  // LLM view (existing code)
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner text="Loading session..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-rose-400 mb-4">{error}</div>
          <button
            onClick={() => sessionQuery.refetch()}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-neutral-100 mb-2">
            Session not found
          </h1>
          <p className="text-neutral-500 mb-6">
            The session you're looking for doesn't exist.
          </p>
          <Link
            to="/dashboard/sessions"
            className="text-accent hover:underline"
          >
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  const sessionId = session.sessionId || id || "";
  const traces = [...session.traces].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const stats = calculateSessionStats(traces);
  const firstTrace = traces[0];
  const user = firstTrace?.metadata?.user as string | undefined;
  const feature = firstTrace?.metadata?.feature as string | undefined;
  const environment = firstTrace?.metadata?.environment as string | undefined;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/sessions")}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
            title="Back to Sessions"
          >
            <BackIcon />
          </button>
          <span className="text-sm font-mono text-accent">{sessionId}</span>
          <CopyButton text={sessionId} />
          {stats.errorCount > 0 ? (
            <span className="text-xs px-1.5 py-0.5 bg-error/10 text-error rounded">
              {stats.errorCount} Error{stats.errorCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
              OK
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sessionId ? (
            <Link
              to={`/dashboard/traces?session_id=${sessionId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
            >
              <ExternalLinkIcon />
              View in Traces
            </Link>
          ) : null}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          {/* Stats Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.traceCount}</div>
                <div className="text-xs text-neutral-500">Traces</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatTokens(stats.totalTokens)}
                </div>
                <div className="text-xs text-neutral-500">Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-accent">
                  {formatCost(stats.totalCost)}
                </div>
                <div className="text-xs text-neutral-500">Cost</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{stats.duration}</div>
                <div className="text-xs text-neutral-500">Duration</div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {(user || feature || environment || firstTrace) && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 mb-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {user && (
                  <div>
                    <span className="text-neutral-500">User</span>
                    <div className="font-mono text-xs mt-1">{user}</div>
                  </div>
                )}
                {feature && (
                  <div>
                    <span className="text-neutral-500">Feature</span>
                    <div className="text-xs mt-1">{feature}</div>
                  </div>
                )}
                {firstTrace && (
                  <div>
                    <span className="text-neutral-500">Started</span>
                    <div className="text-xs mt-1">
                      {formatDate(firstTrace.timestamp)}
                    </div>
                  </div>
                )}
                {environment && (
                  <div>
                    <span className="text-neutral-500">Environment</span>
                    <div className="text-xs mt-1">{environment}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Traces Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Traces</h3>
            </div>

            {traces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-900 border border-neutral-800 rounded-xl">
                <svg
                  className="w-12 h-12 text-neutral-700 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <h3 className="text-sm font-medium text-neutral-400 mb-1">
                  No traces in this session
                </h3>
                <p className="text-xs text-neutral-500">
                  Traces will appear here once recorded
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline connector line */}
                <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-neutral-800"></div>

                <div className="space-y-2 relative">
                  {traces.map((trace, index) => (
                    <div key={trace.traceId} className="relative pl-6">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-0 top-4 w-4 h-4 rounded-full border-2 ${
                          trace.status === "error"
                            ? "bg-error/20 border-error"
                            : "bg-success/20 border-success"
                        }`}
                      ></div>

                      <TraceCard
                        trace={trace}
                        isLatest={index === traces.length - 1}
                        onClick={() =>
                          navigate(`/dashboard/traces/${trace.traceId}`)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Agent Session Detail Component (for spans view)
interface AgentSessionDetailProps {
  sessionId: string;
  spans: Span[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

function AgentSessionDetail({
  sessionId,
  spans,
  loading,
  error,
  onRetry,
  onBack,
}: AgentSessionDetailProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner text="Loading agent session..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-rose-400 mb-4">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
            >
              <BackIcon />
            </button>
            <span className="text-sm font-mono text-accent">{sessionId}</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-neutral-100 mb-2">
              No spans found
            </h1>
            <p className="text-neutral-500 mb-6">
              This session doesn't have any span data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sort spans by timestamp
  const sortedSpans = [...spans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Calculate stats
  const agentRuns = sortedSpans.filter((s) => s.kind === "agent_run").length;
  const toolCalls = sortedSpans.filter((s) => s.kind === "tool_use").length;
  const errorCount = sortedSpans.filter((s) => s.status === "error").length;
  const sessionSpan = sortedSpans.find((s) => s.kind === "session");
  const durationMs = sessionSpan?.durationMs ?? 0;

  const formatSpanDuration = (ms: number | undefined): string => {
    if (!ms) return "--";
    if (ms >= 60000) {
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}m ${secs}s`;
    }
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
          >
            <BackIcon />
          </button>
          <span className="text-sm font-mono text-accent">{sessionId}</span>
          <CopyButton text={sessionId} />
          {errorCount > 0 ? (
            <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded">
              {errorCount} Error{errorCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
              OK
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6">
          {/* Stats Grid */}
          <div className="bg-neutral-900 border border-neutral-800 rounded p-5 mb-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{agentRuns}</div>
                <div className="text-xs text-neutral-500">Agent Runs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{toolCalls}</div>
                <div className="text-xs text-neutral-500">Tool Calls</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {sortedSpans.length}
                </div>
                <div className="text-xs text-neutral-500">Total Spans</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {formatSpanDuration(durationMs)}
                </div>
                <div className="text-xs text-neutral-500">Duration</div>
              </div>
            </div>
          </div>

          {/* Spans Timeline */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Execution Timeline</h3>
            </div>

            <div className="relative">
              {/* Timeline connector line */}
              <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-neutral-800"></div>

              <div className="space-y-2 relative">
                {sortedSpans.map((span) => (
                  <div key={span.spanId} className="relative pl-6">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 top-4 w-4 h-4 rounded-full border-2 ${
                        span.status === "error"
                          ? "bg-rose-500/20 border-rose-500"
                          : span.kind === "tool_use"
                            ? "bg-cyan-500/20 border-cyan-500"
                            : span.kind === "agent_run"
                              ? "bg-violet-500/20 border-violet-500"
                              : "bg-neutral-500/20 border-neutral-500"
                      }`}
                    ></div>

                    <div
                      onClick={() => setSelectedSpan(span)}
                      className={`bg-neutral-900 border rounded p-3 cursor-pointer transition-colors ${
                        selectedSpan?.spanId === span.spanId
                          ? "border-accent/50 bg-neutral-850"
                          : "border-neutral-800 hover:bg-neutral-850"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              span.kind === "tool_use"
                                ? "bg-cyan-500/10 text-cyan-400"
                                : span.kind === "agent_run"
                                  ? "bg-violet-500/10 text-violet-400"
                                  : span.kind === "session"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "bg-neutral-500/10 text-neutral-400"
                            }`}
                          >
                            {span.kind}
                          </span>
                          {span.toolName && (
                            <span className="text-sm font-medium text-neutral-300">
                              {span.toolName}
                            </span>
                          )}
                          {span.model && (
                            <span className="text-xs text-neutral-500">
                              {span.model}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-neutral-500 text-xs">
                          <span>{formatSpanDuration(span.durationMs)}</span>
                          {span.status === "error" && (
                            <span className="text-rose-400">Error</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatDate(span.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Span Detail Side Panel */}
      {selectedSpan && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedSpan(null)}
          />
          <div className="relative w-[600px] bg-neutral-950 border-l border-neutral-800 overflow-y-auto">
            <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    selectedSpan.kind === "tool_use"
                      ? "bg-cyan-500/10 text-cyan-400"
                      : selectedSpan.kind === "agent_run"
                        ? "bg-violet-500/10 text-violet-400"
                        : "bg-neutral-500/10 text-neutral-400"
                  }`}
                >
                  {selectedSpan.kind}
                </span>
                {selectedSpan.toolName && (
                  <span className="text-sm font-medium">
                    {selectedSpan.toolName}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedSpan(null)}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Status</div>
                  <div
                    className={
                      selectedSpan.status === "error"
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }
                  >
                    {selectedSpan.status}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Duration</div>
                  <div>{formatSpanDuration(selectedSpan.durationMs)}</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Source</div>
                  <div className="text-sm">{selectedSpan.source}</div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-1">Timestamp</div>
                <div className="text-sm">
                  {formatDate(selectedSpan.timestamp)}
                </div>
              </div>

              {/* Event Type */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-1">Event Type</div>
                <div className="text-sm font-mono">
                  {selectedSpan.eventType || "—"}
                </div>
              </div>

              {/* IDs */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Span ID</div>
                  <div className="text-xs font-mono text-neutral-400 flex items-center gap-2">
                    {selectedSpan.spanId}
                    <CopyButton text={selectedSpan.spanId} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">
                    Session ID
                  </div>
                  <div className="text-xs font-mono text-neutral-400">
                    {selectedSpan.sessionId}
                  </div>
                </div>
                {selectedSpan.parentSpanId && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">
                      Parent Span ID
                    </div>
                    <div className="text-xs font-mono text-neutral-400">
                      {selectedSpan.parentSpanId}
                    </div>
                  </div>
                )}
                {selectedSpan.toolUseId && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">
                      Tool Use ID
                    </div>
                    <div className="text-xs font-mono text-neutral-400">
                      {selectedSpan.toolUseId}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Model</div>
                  <div className="text-sm">{selectedSpan.model || "—"}</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Agent</div>
                  <div className="text-sm">{selectedSpan.agentName || "—"}</div>
                </div>
              </div>

              {/* Flags */}
              {selectedSpan.isInterrupt && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3">
                  <div className="text-xs text-amber-400">
                    ⚠ This span was interrupted
                  </div>
                </div>
              )}

              {/* Tool Input */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-2">Tool Input</div>
                <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all bg-neutral-850 p-2 rounded max-h-60 overflow-y-auto">
                  {selectedSpan.toolInput
                    ? typeof selectedSpan.toolInput === "string"
                      ? selectedSpan.toolInput
                      : JSON.stringify(selectedSpan.toolInput, null, 2)
                    : "— No input data —"}
                </pre>
              </div>

              {/* Tool Response */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-2">
                  Tool Response
                </div>
                <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all bg-neutral-850 p-2 rounded max-h-60 overflow-y-auto">
                  {selectedSpan.toolResponse
                    ? typeof selectedSpan.toolResponse === "string"
                      ? selectedSpan.toolResponse
                      : JSON.stringify(selectedSpan.toolResponse, null, 2)
                    : "— No response data —"}
                </pre>
              </div>

              {/* Error */}
              {(typeof selectedSpan.error === "string"
                ? selectedSpan.error.trim().length > 0
                : selectedSpan.error != null) && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded p-3">
                  <div className="text-xs text-rose-400 mb-2">Error</div>
                  <pre className="text-xs text-rose-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {typeof selectedSpan.error === "string"
                      ? selectedSpan.error
                      : JSON.stringify(selectedSpan.error, null, 2)}
                  </pre>
                </div>
              )}

              {/* Working Directory */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-1">
                  Working Directory
                </div>
                <div className="text-xs font-mono text-neutral-400">
                  {selectedSpan.cwd || "—"}
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                <div className="text-xs text-neutral-500 mb-2">Metadata</div>
                <pre className="text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all bg-neutral-850 p-2 rounded max-h-40 overflow-y-auto">
                  {selectedSpan.metadata &&
                  Object.keys(selectedSpan.metadata).length > 0
                    ? JSON.stringify(selectedSpan.metadata, null, 2)
                    : "— No metadata —"}
                </pre>
              </div>

              {/* Raw Span Data */}
              <details className="bg-neutral-900 border border-neutral-800 rounded">
                <summary className="p-3 cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                  View Raw Span Data
                </summary>
                <pre className="p-3 pt-0 text-xs text-neutral-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedSpan, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
