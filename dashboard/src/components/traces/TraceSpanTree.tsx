import type { ReactElement } from "react";
import type { Span } from "../../lib/apiClient";

interface TraceSpanTreeProps {
  spans: Span[];
  indentPx?: number;
}

function labelForSpan(span: Span): string {
  return span.label ?? span.toolName ?? span.eventType ?? span.kind;
}

export default function TraceSpanTree({
  spans,
  indentPx = 20,
}: TraceSpanTreeProps) {
  const sorted = [...spans].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const byParent = new Map<string, Span[]>();
  for (const span of sorted) {
    const parent = span.parentSpanId ?? "";
    byParent.set(parent, [...(byParent.get(parent) ?? []), span]);
  }

  // Spans arrive from independent hook events, so a malformed parent chain can
  // cycle. `visited` bounds the recursion per root path.
  const renderSpan = (
    span: Span,
    visited: Set<string>,
    depth = 0,
  ): ReactElement | null => {
    if (visited.has(span.spanId)) return null;
    const nextVisited = new Set(visited).add(span.spanId);
    return (
      <div key={span.spanId}>
        <div
          className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-2 border-b border-neutral-800 last:border-b-0"
          style={{ paddingLeft: depth * indentPx }}
        >
          <div className="min-w-0">
            <div className="text-sm text-neutral-100 truncate">
              {labelForSpan(span)}
            </div>
            <div className="text-xs text-neutral-500 font-mono truncate">
              {span.eventType} · {span.kind}
            </div>
          </div>
          <div className="text-xs text-neutral-400">
            {span.durationMs ? `${span.durationMs}ms` : ""}
          </div>
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
        {(byParent.get(span.spanId) ?? []).map((child) =>
          renderSpan(child, nextVisited, depth + 1),
        )}
      </div>
    );
  };

  const spanIds = new Set(spans.map((span) => span.spanId));
  const roots = sorted.filter(
    (span) => !span.parentSpanId || !spanIds.has(span.parentSpanId),
  );

  return <div>{roots.map((span) => renderSpan(span, new Set()))}</div>;
}
