import { useNavigate } from "react-router-dom";
import {
  formatAgentSource,
  type AgentSessionSummary,
} from "../../lib/agentSessions";

interface SessionsTableProps {
  sessions: AgentSessionSummary[];
  returnTo?: string;
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms >= 3600000) {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  }
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function formatTokens(inputTokens: number, outputTokens: number): string {
  const total = inputTokens + outputTokens;
  if (total === 0) return "--";
  return Intl.NumberFormat("en-US", { notation: "compact" }).format(total);
}

function formatCost(cents: number): string {
  if (cents === 0) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SessionsTable({
  sessions,
  returnTo,
}: SessionsTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (sessionId: string) => {
    navigate(`/dashboard/sessions/${encodeURIComponent(sessionId)}`, {
      state: { returnTo: returnTo ?? "/dashboard/sessions" },
    });
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded p-8 text-center">
        <p className="text-sm text-neutral-500">No sessions found</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded overflow-x-auto">
      <table className="w-full min-w-[1050px]">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Session
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Source
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Time
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Duration
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Traces
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Spans
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Tokens
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.sessionId}
              onClick={() => handleRowClick(session.sessionId)}
              className="border-b border-neutral-800 cursor-pointer hover:bg-neutral-850 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium text-neutral-200 truncate max-w-[360px]"
                    title={session.displayName}
                  >
                    {session.displayName}
                  </div>
                  <div className="text-xs text-neutral-500 truncate max-w-[360px]">
                    {session.subtitle}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {session.sources.length > 0 ? (
                    session.sources.map((source) => (
                      <span
                        key={source}
                        className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded"
                      >
                        {formatAgentSource(source)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-600">--</span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-500">
                  {formatTimeAgo(session.timestamp)}
                </span>
              </td>
              <td className="py-3 px-4">
                {session.status === "error" ? (
                  <span className="text-xs px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-medium">
                    Error
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium">
                    OK
                  </span>
                )}
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {formatDuration(session.durationMs)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {session.traceCount.toLocaleString()}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {session.totalSpans.toLocaleString()}
                </span>
              </td>
              <td className="py-3 px-4">
                <span
                  className="text-sm text-neutral-300"
                  title={
                    session.inputTokens + session.outputTokens > 0
                      ? `${session.inputTokens.toLocaleString()} input / ${session.outputTokens.toLocaleString()} output`
                      : undefined
                  }
                >
                  {formatTokens(session.inputTokens, session.outputTokens)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-300">
                  {formatCost(session.costCents)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
