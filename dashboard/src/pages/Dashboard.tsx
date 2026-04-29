import { useMemo, useState } from "react";
import { StatCard } from "../components/dashboard/StatCard";
import { TimeRangeTabs } from "../components/dashboard/TimeRangeTabs";
import type { TimeRange } from "../components/dashboard/TimeRangeTabs";
import { RecentTracesTable } from "../components/dashboard/RecentTracesTable";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import ToolUsageChart from "../components/analytics/ToolUsageChart";
import CostChart from "../components/analytics/CostChart";
import {
  useAnalyticsQuery,
  useSpansAnalyticsQuery,
  useTracesQuery,
} from "../api";
import { useProject } from "../hooks/useProject";
import type { CostOverTimeByProvider } from "../lib/apiClient";

// Icons for stat cards
const DollarIcon = () => (
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
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const BoltIcon = () => (
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
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const ClockIcon = () => (
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
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const WrenchIcon = () => (
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
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const CheckCircleIcon = () => (
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
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const AlertIcon = () => (
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
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

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

const TokensIcon = () => (
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
      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
);

const SessionsIcon = () => (
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
      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
    />
  </svg>
);

function getDateRange(range: TimeRange): {
  date_from: string;
  date_to: string;
} {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (range) {
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { date_from: from.toISOString(), date_to: to };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  if (cost >= 1000) {
    return "$" + (cost / 1000).toFixed(1) + "K";
  }
  return "$" + cost.toFixed(2);
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) {
    return (ms / 1000).toFixed(1) + "s";
  }
  return ms + "ms";
}

export default function Dashboard() {
  const { selectedProject } = useProject();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const { date_from, date_to } = useMemo(
    () => getDateRange(timeRange),
    [timeRange],
  );

  // LLM/Trace analytics
  const analyticsQuery = useAnalyticsQuery(
    "dashboard-analytics",
    selectedProject?.id,
    {
      date_from,
      date_to,
      group_by: "day",
    },
  );

  // Span/Agent analytics
  const spansQuery = useSpansAnalyticsQuery(
    "dashboard-spans-analytics",
    selectedProject?.id,
    {
      date_from,
      date_to,
      group_by: "day",
    },
  );

  // Recent traces for table
  const recentTracesQuery = useTracesQuery(
    "dashboard-recent-traces",
    selectedProject?.id,
    {
      limit: 10,
    },
  );

  const analytics = analyticsQuery.data;
  const spansAnalytics = spansQuery.data;
  const recentTraces = recentTracesQuery.data?.traces ?? [];
  const loading =
    analyticsQuery.isPending ||
    analyticsQuery.isFetching ||
    spansQuery.isPending;
  const tracesLoading =
    recentTracesQuery.isPending || recentTracesQuery.isFetching;
  const error =
    analyticsQuery.error instanceof Error
      ? analyticsQuery.error.message
      : spansQuery.error instanceof Error
        ? spansQuery.error.message
        : null;

  // LLM metrics (from trace analytics)
  const errorRate = analytics?.errorRate ?? 0;

  // Span/Agent metrics (from spans analytics)
  const agentRuns = spansAnalytics?.agentRuns ?? 0;
  const toolCalls = spansAnalytics?.toolCalls ?? 0;
  const avgSessionDuration = spansAnalytics?.avgSessionDurationMs ?? 0;
  const successRate = spansAnalytics?.successRate ?? 100 - errorRate;
  const topTools = spansAnalytics?.topTools ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">Overview</h1>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeTabs value={timeRange} onChange={setTimeRange} />
          <button
            onClick={() => {
              analyticsQuery.refetch();
              spansQuery.refetch();
            }}
            disabled={loading}
            className="p-1.5 rounded border border-neutral-700 hover:bg-neutral-850 hover:border-neutral-600 transition-colors disabled:opacity-50"
          >
            <span className={loading ? "animate-spin inline-block" : ""}>
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded">
              <div className="flex items-center justify-between gap-4">
                <p className="text-rose-400 text-sm">{error}</p>
                <button
                  onClick={() => analyticsQuery.refetch()}
                  className="text-sm text-accent hover:underline whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* First Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Sessions"
              value={analytics ? formatNumber(analytics.totalSessions) : "--"}
              icon={<SessionsIcon />}
              color="violet"
              subtitle={`${timeRange} period`}
            />
            <StatCard
              label="Agent Runs"
              value={formatNumber(agentRuns)}
              icon={<BoltIcon />}
              color="blue"
              subtitle={`${timeRange} period`}
            />
            <StatCard
              label="Tool Calls"
              value={formatNumber(toolCalls)}
              icon={<WrenchIcon />}
              color="cyan"
              subtitle={`${timeRange} period`}
            />
            <StatCard
              label="Avg Duration"
              value={formatDuration(avgSessionDuration)}
              icon={<ClockIcon />}
              color="amber"
              subtitle={`${timeRange} period`}
            />
          </div>

          {/* Second Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Cost"
              value={analytics ? formatCost(analytics.totalCost) : "--"}
              icon={<DollarIcon />}
              color="emerald"
              subtitle={`${timeRange} period`}
            />
            <StatCard
              label="Tokens"
              value={
                analytics
                  ? formatNumber(
                      analytics.totalTokens.input +
                        analytics.totalTokens.output,
                    )
                  : "--"
              }
              icon={<TokensIcon />}
              color="purple"
              subtitle={`${analytics ? formatNumber(analytics.totalTokens.input) : "0"} in / ${analytics ? formatNumber(analytics.totalTokens.output) : "0"} out`}
            />
            <StatCard
              label="Error Rate"
              value={analytics ? analytics.errorRate.toFixed(1) + "%" : "--"}
              icon={<AlertIcon />}
              color="rose"
              subtitle={
                analytics
                  ? `${Math.round(analytics.totalRequests * (analytics.errorRate / 100))} failed`
                  : `${timeRange} period`
              }
            />
            <StatCard
              label="Success Rate"
              value={successRate.toFixed(1) + "%"}
              icon={<CheckCircleIcon />}
              color="emerald"
              subtitle={`${timeRange} period`}
            />
          </div>

          {analyticsQuery.isPending && !analytics && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="Loading analytics..." />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Cost Over Time Chart */}
            <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Activity Over Time</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Cost by day</p>
                </div>
              </div>
              {analytics && (
                <CostChart
                  data={analytics.costOverTime.map(
                    (d: CostOverTimeByProvider) => ({
                      period: d.period,
                      cost: d.costCents / 100,
                      provider: d.provider,
                    }),
                  )}
                  groupBy="day"
                />
              )}
            </div>

            {/* Tool Usage */}
            <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Tool Usage</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Top tools this period
                  </p>
                </div>
              </div>
              <ToolUsageChart data={topTools} maxItems={5} />
            </div>
          </div>

          {/* Recent Traces */}
          <RecentTracesTable traces={recentTraces} loading={tracesLoading} />
        </div>
      </div>
    </div>
  );
}
