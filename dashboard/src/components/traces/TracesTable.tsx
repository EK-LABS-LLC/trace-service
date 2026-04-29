import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Trace } from "../../lib/apiClient";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

interface TracesTableProps {
  traces: Trace[];
  onRowClick?: (trace: Trace) => void;
  pagination?: PaginationProps;
}

type SortField =
  | "timestamp"
  | "latencyMs"
  | "inputTokens"
  | "outputTokens"
  | "costCents";
type SortDirection = "asc" | "desc";

const SortIcon = ({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) => (
  <svg
    className={`w-3 h-3 ${active ? "text-accent" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    {active && direction === "desc" ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    ) : active && direction === "asc" ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    ) : (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    )}
  </svg>
);

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return {
    display: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    relative: getRelativeTime(date),
  };
};

const getRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

const formatLatency = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatCost = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "--";
  return `$${(cents / 100).toFixed(4)}`;
};

const formatTokens = (tokens: number | null | undefined) => {
  if (tokens === null || tokens === undefined) return "--";
  return tokens.toLocaleString();
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const ChevronLeftIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const ChevronDoubleLeftIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
    />
  </svg>
);

const ChevronDoubleRightIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 5l7 7-7 7M5 5l7 7-7 7"
    />
  </svg>
);

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const isFirstPage = page === 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral-500">
          {total > 0
            ? `${startItem}-${endItem} of ${total.toLocaleString()}`
            : "0 results"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
          title="First page"
        >
          <ChevronDoubleLeftIcon />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={isFirstPage}
          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
          title="Previous page"
        >
          <ChevronLeftIcon />
        </button>
        <span className="px-3 text-sm text-neutral-400">
          Page {page} of {totalPages > 0 ? totalPages.toLocaleString() : 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={isLastPage}
          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
          title="Next page"
        >
          <ChevronRightIcon />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500"
          title="Last page"
        >
          <ChevronDoubleRightIcon />
        </button>
      </div>
    </div>
  );
}

interface SortableHeaderProps {
  field: SortField;
  children: React.ReactNode;
  onSort: (field: SortField) => void;
  sortField: SortField;
  sortDirection: SortDirection;
}

function SortableHeader({
  field,
  children,
  onSort,
  sortField,
  sortDirection,
}: SortableHeaderProps) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-neutral-300"
    >
      {children}
      <SortIcon active={sortField === field} direction={sortDirection} />
    </button>
  );
}

export default function TracesTable({
  traces,
  onRowClick,
  pagination,
}: TracesTableProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedTraces = [...traces].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortField) {
      case "timestamp":
        aVal = new Date(a.timestamp).getTime();
        bVal = new Date(b.timestamp).getTime();
        break;
      case "latencyMs":
        aVal = a.latencyMs ?? 0;
        bVal = b.latencyMs ?? 0;
        break;
      case "inputTokens":
        aVal = a.inputTokens ?? 0;
        bVal = b.inputTokens ?? 0;
        break;
      case "outputTokens":
        aVal = a.outputTokens ?? 0;
        bVal = b.outputTokens ?? 0;
        break;
      case "costCents":
        aVal = a.costCents ?? 0;
        bVal = b.costCents ?? 0;
        break;
    }

    if (sortDirection === "asc") {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
  });

  const handleRowClick = (trace: Trace) => {
    setSelectedId(trace.traceId);
    if (onRowClick) {
      onRowClick(trace);
    } else {
      navigate(`/dashboard/traces/${trace.traceId}`);
    }
  };

  return (
    <div className="flex flex-col">
      <table className="w-full">
        <thead className="bg-neutral-900">
          <tr className="border-b border-neutral-800">
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              Trace ID
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              <SortableHeader
                field="timestamp"
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              >
                Timestamp
              </SortableHeader>
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              Provider
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              Model
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              <SortableHeader
                field="inputTokens"
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              >
                Input
              </SortableHeader>
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              <SortableHeader
                field="outputTokens"
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              >
                Output
              </SortableHeader>
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              <SortableHeader
                field="latencyMs"
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              >
                Latency
              </SortableHeader>
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              <SortableHeader
                field="costCents"
                onSort={handleSort}
                sortField={sortField}
                sortDirection={sortDirection}
              >
                Cost
              </SortableHeader>
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              Status
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-medium text-neutral-500">
              Session
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTraces.map((trace) => {
            const { display, relative } = formatTimestamp(trace.timestamp);
            const isError = trace.status === "error";
            const isSelected = selectedId === trace.traceId;

            return (
              <tr
                key={trace.traceId}
                onClick={() => handleRowClick(trace)}
                className={`
                  border-b border-neutral-800 cursor-pointer transition-colors
                  ${isError ? "bg-error/5 hover:bg-error/[0.08]" : "bg-neutral-900 hover:bg-neutral-850"}
                  ${isSelected ? "bg-accent/[0.08]" : ""}
                `}
              >
                <td className="py-2.5 px-4">
                  <span className="text-sm font-mono text-accent/80 truncate max-w-[100px] inline-block">
                    {trace.traceId.length > 12
                      ? `${trace.traceId.slice(0, 12)}`
                      : trace.traceId}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="text-sm">{display}</div>
                  <div className="text-xs text-neutral-500">{relative}</div>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded capitalize">
                    {trace.provider}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span
                    className="text-sm truncate max-w-[120px] inline-block"
                    title={trace.modelRequested}
                  >
                    {trace.modelRequested}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-sm text-neutral-400">
                    {formatTokens(trace.inputTokens)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-sm text-neutral-400">
                    {isError ? "--" : formatTokens(trace.outputTokens)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-sm">
                    {isError ? "--" : formatLatency(trace.latencyMs)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-sm">
                    {isError ? "--" : formatCost(trace.costCents)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  {isError ? (
                    <span className="text-xs px-1.5 py-0.5 bg-error/10 text-error rounded">
                      ERR
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
                      OK
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  {trace.sessionId ? (
                    <span className="text-xs font-mono text-neutral-500 truncate max-w-[80px] inline-block">
                      {trace.sessionId.length > 10
                        ? `${trace.sessionId.slice(0, 10)}...`
                        : trace.sessionId}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-600">--</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pagination && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
