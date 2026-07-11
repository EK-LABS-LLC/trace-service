import { useMemo, type ReactElement } from "react";
import { useParams, Link } from "react-router-dom";
import TraceHeader from "../components/traces/TraceHeader";
import TraceMetadata from "../components/traces/TraceMetadata";
import JsonViewer from "../components/traces/JsonViewer";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useTraceDetailQuery } from "../api";
import { useProject } from "../hooks/useProject";
import type { Span } from "../lib/apiClient";

function NotFoundState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-100 mb-4">404</h1>
        <p className="text-neutral-400 mb-6">Trace not found</p>
        <Link to="/traces" className="text-accent hover:underline">
          Back to Traces
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

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-rose-400 mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent hover:bg-accent/90 rounded text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function labelForSpan(span: Span): string {
  return span.toolName ?? span.eventType ?? span.kind;
}

function TraceSpanHierarchy({ spans }: { spans: Span[] }) {
  const sorted = [...spans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const byParent = new Map<string, Span[]>();
  for (const span of sorted) {
    const parent = span.parentSpanId ?? "";
    byParent.set(parent, [...(byParent.get(parent) ?? []), span]);
  }

  const renderSpan = (span: Span, depth = 0): ReactElement => (
    <div key={span.spanId}>
      <div
        className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-2 border-b border-neutral-800 last:border-b-0"
        style={{ paddingLeft: depth * 20 }}
      >
        <div className="min-w-0">
          <div className="text-sm text-neutral-100 truncate">{labelForSpan(span)}</div>
          <div className="text-xs text-neutral-500 font-mono truncate">
            {span.eventType} · {span.kind}
          </div>
        </div>
        <div className="text-xs text-neutral-400">{span.durationMs ? `${span.durationMs}ms` : ""}</div>
        <div
          className={
            span.status === "error"
              ? "text-xs text-rose-400"
              : "text-xs text-emerald-400"
          }
        >
          {span.status}
        </div>
      </div>
      {(byParent.get(span.spanId) ?? []).map((child) => renderSpan(child, depth + 1))}
    </div>
  );

  const roots = byParent.get("") ?? sorted.filter((span) => !spans.some((s) => s.spanId === span.parentSpanId));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs text-neutral-500 uppercase tracking-wide mb-4">Timeline</h3>
      <div>{roots.map((span) => renderSpan(span))}</div>
    </div>
  );
}

export default function TraceDetail() {
  const { selectedProject } = useProject();
  const { id } = useParams<{ id: string }>();

  const traceQuery = useTraceDetailQuery(selectedProject?.id, id);

  const loading = traceQuery.isPending;
  const trace = traceQuery.data ?? null;
  const errorMessage =
    traceQuery.error instanceof Error ? traceQuery.error.message : null;

  const notFound = useMemo(() => {
    if (!id) return true;
    if (!errorMessage) return false;
    const message = errorMessage.toLowerCase();
    return message.includes("404") || message.includes("not found");
  }, [id, errorMessage]);

  if (loading) {
    return <LoadingState />;
  }

  if (notFound) {
    return <NotFoundState />;
  }

  if (errorMessage) {
    return (
      <ErrorState message={errorMessage} onRetry={() => traceQuery.refetch()} />
    );
  }

  if (!trace) {
    return <NotFoundState />;
  }

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

          {trace.spans && trace.spans.length > 0 && (
            <TraceSpanHierarchy spans={trace.spans} />
          )}

          {trace.metadata && Object.keys(trace.metadata).length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <h3 className="text-xs text-neutral-500 uppercase tracking-wide mb-4">
                Custom Metadata
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(trace.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-neutral-500 mb-1">{key}</dt>
                    <dd className="text-sm text-neutral-100 font-mono">
                      {typeof value === "string"
                        ? value
                        : JSON.stringify(value)}
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
