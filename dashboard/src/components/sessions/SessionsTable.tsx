import { useNavigate } from "react-router-dom";

export interface SessionSummary {
  session_id: string;
  first_trace_time: string;
  last_trace_time: string;
  trace_count: number;
  total_tokens: number;
  total_cost_cents: number;
  error_count: number;
  user?: string;
}

interface SessionsTableProps {
  sessions: SessionSummary[];
  onRowClick?: (sessionId: string) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
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

export default function SessionsTable({
  sessions,
  onRowClick,
}: SessionsTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (sessionId: string) => {
    if (onRowClick) {
      onRowClick(sessionId);
    } else {
      navigate(`/dashboard/sessions/${sessionId}`);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
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
            d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
          />
        </svg>
        <h3 className="text-sm font-medium text-neutral-400 mb-1">
          No sessions found
        </h3>
        <p className="text-xs text-neutral-500">
          Sessions will appear here once traces with session IDs are recorded
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-neutral-900">
          <tr className="border-b border-neutral-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Session ID
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Started
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Traces
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Tokens
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Cost
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Duration
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              User
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr
              key={session.session_id}
              onClick={() => handleRowClick(session.session_id)}
              className={`border-b border-neutral-800 cursor-pointer transition-colors hover:bg-neutral-850 ${
                session.error_count > 0
                  ? "bg-rose-500/5 hover:bg-rose-500/8"
                  : "bg-neutral-900"
              }`}
            >
              <td className="py-3 px-4">
                <span className="text-sm font-mono text-accent">
                  {session.session_id}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="text-sm">
                  {formatDate(session.first_trace_time)}
                </div>
                <div className="text-xs text-neutral-500">
                  {formatRelativeTime(session.first_trace_time)}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm">{session.trace_count}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-neutral-400">
                  {formatTokens(session.total_tokens)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm">
                  {formatCost(session.total_cost_cents)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm">
                  {formatDuration(
                    session.first_trace_time,
                    session.last_trace_time,
                  )}
                </span>
              </td>
              <td className="py-3 px-4">
                {session.user ? (
                  <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                    {session.user}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-600">—</span>
                )}
              </td>
              <td className="py-3 px-4">
                {session.error_count > 0 ? (
                  <span className="text-xs px-1.5 py-0.5 bg-error/10 text-error rounded">
                    {session.error_count} Error
                    {session.error_count > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                    OK
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
