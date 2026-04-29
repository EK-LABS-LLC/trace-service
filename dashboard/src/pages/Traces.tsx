import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { Trace, GetTracesParams } from "../lib/apiClient";
import { useTracesQuery } from "../api";
import FilterSidebar from "../components/traces/FilterSidebar";
import TracesTable from "../components/traces/TracesTable";
import TraceDetailPanel from "../components/traces/TraceDetailPanel";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { useProject } from "../hooks/useProject";

const RefreshIcon = () => (
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
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export interface TracesFilters {
  provider: string;
  model: string;
  status: string;
  date_from: string;
  date_to: string;
  session_id: string;
}

const defaultFilters: TracesFilters = {
  provider: "",
  model: "",
  status: "",
  date_from: "",
  date_to: "",
  session_id: "",
};

const DEFAULT_PAGE_SIZE = 25;

const toIsoDateRangeParam = (
  value: string,
  boundary: "start" | "end",
): string => {
  if (!value) return value;
  if (value.includes("T")) return value;
  if (boundary === "start") return `${value}T00:00:00.000Z`;
  return `${value}T23:59:59.999Z`;
};

export default function Traces() {
  const { selectedProject } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  });

  const [pageSize, setPageSize] = useState(() => {
    const pageSizeParam = searchParams.get("pageSize");
    return pageSizeParam ? parseInt(pageSizeParam, 10) : DEFAULT_PAGE_SIZE;
  });

  const [filters, setFilters] = useState<TracesFilters>(() => ({
    provider: searchParams.get("provider") || "",
    model: searchParams.get("model") || "",
    status: searchParams.get("status") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    session_id: searchParams.get("session_id") || "",
  }));

  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null);

  const queryParams = useMemo<GetTracesParams>(() => {
    const params: GetTracesParams = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };

    if (filters.provider) params.provider = filters.provider;
    if (filters.model) params.model = filters.model;
    if (filters.status) params.status = filters.status;
    if (filters.date_from)
      params.date_from = toIsoDateRangeParam(filters.date_from, "start");
    if (filters.date_to)
      params.date_to = toIsoDateRangeParam(filters.date_to, "end");
    if (filters.session_id) params.session_id = filters.session_id;

    return params;
  }, [filters, page, pageSize]);

  const tracesQuery = useTracesQuery(
    "traces",
    selectedProject?.id,
    queryParams,
  );

  const traces = tracesQuery.data?.traces ?? [];
  const total = tracesQuery.data?.total ?? 0;
  const loading = tracesQuery.isPending;
  const error =
    tracesQuery.error instanceof Error ? tracesQuery.error.message : null;

  const updateUrlParams = (
    newFilters: TracesFilters,
    newPage: number,
    newPageSize: number,
  ) => {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (newPage > 1) params.set("page", String(newPage));
    if (newPageSize !== DEFAULT_PAGE_SIZE)
      params.set("pageSize", String(newPageSize));
    setSearchParams(params);
  };

  const applyFilters = (newFilters: TracesFilters) => {
    setFilters(newFilters);
    setPage(1);
    updateUrlParams(newFilters, 1, pageSize);
    setSelectedTrace(null);
  };

  const clearFilters = () => {
    applyFilters(defaultFilters);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams(filters, newPage, pageSize);
    setSelectedTrace(null);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    updateUrlParams(filters, 1, newPageSize);
    setSelectedTrace(null);
  };

  const handleRowClick = (trace: Trace) => {
    setSelectedTrace(trace);
  };

  const handleClosePanel = () => {
    setSelectedTrace(null);
  };

  const handleNavigateTrace = (direction: "prev" | "next") => {
    if (!selectedTrace) return;
    const currentIndex = traces.findIndex(
      (t) => t.traceId === selectedTrace.traceId,
    );
    if (currentIndex === -1) return;

    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < traces.length) {
      setSelectedTrace(traces[newIndex] ?? null);
    }
  };

  const selectedTraceIndex = selectedTrace
    ? traces.findIndex((t) => t.traceId === selectedTrace.traceId)
    : -1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">Traces</h1>
          <span className="text-xs text-neutral-500">
            {total.toLocaleString()} total
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => tracesQuery.refetch()}
            disabled={loading || tracesQuery.isFetching}
            className="p-1.5 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors disabled:opacity-50"
          >
            <span
              className={
                tracesQuery.isFetching ? "animate-spin inline-block" : ""
              }
            >
              <RefreshIcon />
            </span>
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

      {/* Content Area - Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        <FilterSidebar
          filters={filters}
          onApplyFilters={applyFilters}
          onClearFilters={clearFilters}
        />

        <main className="flex-1 overflow-hidden relative">
          <div
            className={`h-full overflow-auto p-6 ${selectedTrace ? "pr-[460px]" : ""}`}
          >
            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-rose-400 text-sm">{error}</p>
                  <button
                    onClick={() => tracesQuery.refetch()}
                    className="text-sm text-accent hover:underline whitespace-nowrap"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <TableSkeleton rows={pageSize} columns={9} />
              </div>
            ) : traces.length === 0 ? (
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
                    d="M4 6h16M4 12h16M4 18h7"
                  />
                </svg>
                <h3 className="text-sm font-medium text-neutral-400 mb-1">
                  No traces found
                </h3>
                <p className="text-xs text-neutral-500">
                  Try adjusting your filters or check back later
                </p>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <TracesTable
                  traces={traces}
                  onRowClick={handleRowClick}
                  pagination={{
                    page,
                    pageSize,
                    total,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange,
                  }}
                />
              </div>
            )}
          </div>

          {selectedTrace && (
            <TraceDetailPanel
              trace={selectedTrace}
              onClose={handleClosePanel}
              onNavigate={handleNavigateTrace}
              hasPrev={selectedTraceIndex > 0}
              hasNext={selectedTraceIndex < traces.length - 1}
            />
          )}
        </main>
      </div>
    </div>
  );
}
