import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import TraceHeader from "../components/traces/TraceHeader";
import TraceMetadata from "../components/traces/TraceMetadata";
import JsonViewer from "../components/traces/JsonViewer";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useOTelTraceQuery, useOTelTraceSpansQuery, useTraceDetailQuery } from "../api";
import { useProject } from "../hooks/useProject";
import type { Span, Trace } from "../lib/apiClient";

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10 19l-7-7m0 0l7-7m-7 7h18"
    />
  </svg>
);

function NotFoundState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-100 mb-4">404</h1>
        <p className="text-neutral-400 mb-6">Trace not found</p>
        <Link to="/dashboard/sessions" className="text-accent hover:underline">
          Back to Sessions
        </Link>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <LoadingSpinner text="Loading trace..." />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-rose-400 mb-4">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-accent hover:bg-accent/90 rounded text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return "0ms";
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getSpanLabel(span: Span): string {
  return span.name || span.toolName || span.eventType || span.kind;
}

function getSpanDepths(spans: Span[]): Map<string, number> {
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const depths = new Map<string, number>();

  const depthFor = (span: Span, seen = new Set<string>()): number => {
    if (depths.has(span.spanId)) return depths.get(span.spanId) ?? 0;
    if (!span.parentSpanId || seen.has(span.spanId)) {
      depths.set(span.spanId, 0);
      return 0;
    }
    const parent = byId.get(span.parentSpanId);
    if (!parent) {
      depths.set(span.spanId, 0);
      return 0;
    }
    seen.add(span.spanId);
    const depth = depthFor(parent, seen) + 1;
    depths.set(span.spanId, depth);
    return depth;
  };

  spans.forEach((span) => depthFor(span));
  return depths;
}

function LegacyTraceDetail({ trace }: { trace: Trace }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TraceHeader
        traceId={trace.traceId}
        status={trace.status}
        timestamp={trace.timestamp}
        provider={trace.provider}
        model={trace.modelRequested}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <TraceMetadata trace={trace} />

          {trace.metadata && Object.keys(trace.metadata).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
              <h3 className="text-xs text-neutral-500 uppercase tracking-wide mb-4">
                Custom Metadata
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(trace.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-neutral-500 mb-1">{key}</dt>
                    <dd className="text-sm text-neutral-100 font-mono">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <JsonViewer data={trace.requestBody || {}} title="Request" />
            {trace.status === "error" && trace.error ? (
              <JsonViewer data={trace.error} title="Error" />
            ) : (
              <JsonViewer data={trace.responseBody || {}} title="Response" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TraceDetail() {
  const { selectedProject } = useProject();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const locationState = location.state as { returnTo?: unknown } | null;

  const otelTraceQuery = useOTelTraceQuery(selectedProject?.id, id);
  const otelTrace = otelTraceQuery.data ?? null;
  const otelError = otelTraceQuery.error instanceof Error ? otelTraceQuery.error.message : null;
  const otelNotFound =
    !!otelError && (otelError.toLowerCase().includes("not found") || otelError.includes("404"));

  const legacyTraceQuery = useTraceDetailQuery(selectedProject?.id, id, otelNotFound);
  const legacyTrace = legacyTraceQuery.data ?? null;
  const legacyError =
    legacyTraceQuery.error instanceof Error ? legacyTraceQuery.error.message : null;

  const spansQuery = useOTelTraceSpansQuery(selectedProject?.id, id, !!otelTrace);
  const spans = useMemo(
    () =>
      [...(spansQuery.data?.spans ?? [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [spansQuery.data?.spans]
  );
  const spanDepths = useMemo(() => getSpanDepths(spans), [spans]);

  if (!id) return <NotFoundState />;
  if (otelTraceQuery.isPending) return <LoadingState />;
  if (otelTrace && spansQuery.isPending) return <LoadingState />;
  if (otelNotFound && legacyTraceQuery.isPending) return <LoadingState />;
  if (otelNotFound && legacyTrace) return <LegacyTraceDetail trace={legacyTrace} />;
  if (otelNotFound && legacyError) return <NotFoundState />;
  if (!otelTrace && otelError) {
    return <ErrorState message={otelError} onRetry={() => otelTraceQuery.refetch()} />;
  }
  if (!otelTrace) return <NotFoundState />;

  const spansError = spansQuery.error instanceof Error ? spansQuery.error.message : null;
  if (spansError) {
    return <ErrorState message={spansError} onRetry={() => spansQuery.refetch()} />;
  }

  const returnTo =
    typeof locationState?.returnTo === "string" && locationState.returnTo.startsWith("/dashboard")
      ? locationState.returnTo
      : otelTrace.sessionId
        ? `/dashboard/sessions/${encodeURIComponent(otelTrace.sessionId)}`
        : "/dashboard/sessions";

  const agentRuns = spans.filter((span) => span.kind === "agent_run").length;
  const toolCalls = spans.filter((span) => span.kind === "tool_use").length;
  const tokens = otelTrace.inputTokens + otelTrace.outputTokens;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
            title="Back"
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-100 truncate max-w-[540px]">
              {otelTrace.name}
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="font-mono truncate max-w-[420px]" title={otelTrace.traceId}>
                {otelTrace.traceId}
              </span>
              <span>{otelTrace.source}</span>
            </div>
          </div>
          {otelTrace.status === "error" ? (
            <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded">
              {otelTrace.errorCount || 1} Error{otelTrace.errorCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
              OK
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded p-5 mb-6">
            <div className="grid grid-cols-6 gap-3">
              <div className="text-center">
                <div className="text-lg font-semibold">{spans.length}</div>
                <div className="text-xs text-neutral-500">Spans</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{agentRuns}</div>
                <div className="text-xs text-neutral-500">Agent Runs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{toolCalls}</div>
                <div className="text-xs text-neutral-500">Tool Calls</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{formatTokens(tokens)}</div>
                <div className="text-xs text-neutral-500">Tokens</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-accent">
                  {formatCost(otelTrace.costCents)}
                </div>
                <div className="text-xs text-neutral-500">Cost</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">{formatDuration(otelTrace.durationMs)}</div>
                <div className="text-xs text-neutral-500">Duration</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
              <div className="text-xs text-neutral-500 mb-1">Session ID</div>
              <div className="text-xs font-mono text-neutral-300 break-all">
                {otelTrace.sessionId || "-"}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
              <div className="text-xs text-neutral-500 mb-1">Time Window</div>
              <div className="text-xs text-neutral-300">
                {formatDate(otelTrace.startedAt)} to {formatDate(otelTrace.endedAt)}
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Spans</h3>
            <span className="text-xs text-neutral-500">
              Timed operations sharing this trace_id
            </span>
          </div>

          {spans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-900 border border-neutral-800 rounded">
              <h3 className="text-sm font-medium text-neutral-400 mb-1">No spans found</h3>
              <p className="text-xs text-neutral-500">This trace summary has no stored spans.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-4 bottom-4 w-[2px] bg-neutral-800"></div>
              <div className="space-y-2 relative">
                {spans.map((span) => {
                  const depth = spanDepths.get(span.spanId) ?? 0;
                  return (
                    <div key={span.spanId} className="relative pl-6" style={{ marginLeft: depth * 24 }}>
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

                      <button
                        type="button"
                        onClick={() => setSelectedSpan(span)}
                        className={`w-full bg-neutral-900 border rounded p-3 text-left transition-colors ${
                          selectedSpan?.spanId === span.spanId
                            ? "border-accent/50 bg-neutral-850"
                            : "border-neutral-800 hover:bg-neutral-850"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">
                                {span.kind}
                              </span>
                              {span.otelKind ? (
                                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500">
                                  {span.otelKind}
                                </span>
                              ) : null}
                              <span className="truncate text-sm font-medium text-neutral-200">
                                {getSpanLabel(span)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {formatDate(span.timestamp)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-500">
                            <span>{formatDuration(span.durationMs)}</span>
                            {span.status === "error" ? (
                              <span className="text-rose-400">Error</span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedSpan ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedSpan(null)} />
          <div className="relative w-[640px] bg-neutral-950 border-l border-neutral-800 overflow-y-auto">
            <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{getSpanLabel(selectedSpan)}</div>
                <div className="text-xs font-mono text-neutral-500 truncate">
                  {selectedSpan.spanId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpan(null)}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Status</div>
                  <div className={selectedSpan.status === "error" ? "text-rose-400" : "text-emerald-400"}>
                    {selectedSpan.status}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Duration</div>
                  <div>{formatDuration(selectedSpan.durationMs)}</div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
                  <div className="text-xs text-neutral-500 mb-1">Source</div>
                  <div className="text-sm">{selectedSpan.source}</div>
                </div>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Trace ID</div>
                  <div className="text-xs font-mono text-neutral-400 break-all">
                    {selectedSpan.traceId || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Span ID</div>
                  <div className="text-xs font-mono text-neutral-400 break-all">
                    {selectedSpan.spanId}
                  </div>
                </div>
                {selectedSpan.parentSpanId ? (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Parent Span ID</div>
                    <div className="text-xs font-mono text-neutral-400 break-all">
                      {selectedSpan.parentSpanId}
                    </div>
                  </div>
                ) : null}
              </div>

              <JsonViewer data={selectedSpan.attributes || {}} title="Attributes" />
              <JsonViewer data={selectedSpan.resource || {}} title="Resource" />
              <JsonViewer data={selectedSpan.scope || {}} title="Scope" />
              <JsonViewer data={selectedSpan.events || []} title="Events" />
              <JsonViewer data={selectedSpan.links || []} title="Links" />

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
      ) : null}
    </div>
  );
}
