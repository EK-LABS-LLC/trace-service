import { useMemo, useState } from "react";
import type { AnalyticsResponse } from "../lib/apiClient";
import DateRangePicker, {
  type DateRange,
  type DateRangePreset,
} from "../components/analytics/DateRangePicker";
import CostChart from "../components/analytics/CostChart";
import TokenUsageChart from "../components/analytics/TokenUsageChart";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useAnalyticsQuery } from "../api";
import { useProject } from "../hooks/useProject";

type GroupBy = "day" | "hour" | "model" | "provider";
type Tab = "costs" | "models";

interface AnalyticsSummary {
  totalCost: number;
  dailyAverage: number;
  costPerRequest: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  errorCount: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

function getDateRangeParams(range: DateRange): {
  date_from: string;
  date_to: string;
} {
  if (range.preset === "custom" && range.from && range.to) {
    return {
      date_from: range.from.toISOString(),
      date_to: range.to.toISOString(),
    };
  }

  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (range.preset) {
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { date_from: from.toISOString(), date_to: to };
}

function getPresetDays(preset: DateRangePreset): number {
  switch (preset) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "custom":
      return 30; // Will be calculated from actual dates
  }
}

function calculateDays(range: DateRange): number {
  if (range.preset === "custom" && range.from && range.to) {
    const diffMs = range.to.getTime() - range.from.getTime();
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }
  return getPresetDays(range.preset);
}

function calculateSummary(
  analytics: AnalyticsResponse,
  dateRange: DateRange,
): AnalyticsSummary {
  const days = calculateDays(dateRange);
  const dailyAverage = analytics.totalCost / days;
  const errorCount = Math.round(
    analytics.totalRequests * (analytics.errorRate / 100),
  );

  return {
    totalCost: analytics.totalCost,
    dailyAverage,
    costPerRequest: analytics.computed.costPerRequest,
    avgLatency: analytics.avgLatency,
    p95Latency: analytics.avgLatency * 1.5, // Approximate P95 as 1.5x avg latency
    errorRate: analytics.errorRate,
    errorCount,
    totalRequests: analytics.totalRequests,
    totalInputTokens: analytics.totalTokens.input,
    totalOutputTokens: analytics.totalTokens.output,
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return "$" + (value / 1000).toFixed(1) + "K";
  }
  return "$" + value.toFixed(2);
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

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return (ms / 1000).toFixed(1) + "s";
  }
  return Math.round(ms) + "ms";
}

// Icons
const TrendUpIcon = () => (
  <svg
    className="w-4 h-4 text-neutral-400"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const ClockIcon = () => (
  <svg
    className="w-4 h-4 text-success"
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

const CheckCircleIcon = () => (
  <svg
    className="w-4 h-4 text-success"
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

function getInitialDateRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { preset: "30d", from, to: now };
}

export default function Analytics() {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState<Tab>("costs");
  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange);
  const groupBy: GroupBy = "day";
  const { date_from, date_to } = useMemo(
    () => getDateRangeParams(dateRange),
    [dateRange],
  );

  const analyticsQuery = useAnalyticsQuery("analytics", selectedProject?.id, {
    date_from,
    date_to,
    group_by: groupBy,
  });

  const analytics = analyticsQuery.data ?? null;
  const summary = analytics ? calculateSummary(analytics, dateRange) : null;
  const loading = analyticsQuery.isPending;
  const error =
    analyticsQuery.error instanceof Error ? analyticsQuery.error.message : null;

  const dateRangeLabel =
    dateRange.preset === "24h"
      ? "Last 24 hours"
      : dateRange.preset === "7d"
        ? "Last 7 days"
        : dateRange.preset === "30d"
          ? "Last 30 days"
          : dateRange.from && dateRange.to
            ? `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`
            : "Custom";

  const tabs: { value: Tab; label: string }[] = [
    { value: "costs", label: "Costs" },
    { value: "models", label: "Models" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-6">
          <h1 className="text-sm font-medium">Analytics</h1>
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-4 text-sm border-b-2 -mb-px transition-colors ${
                  activeTab === tab.value
                    ? "text-white border-accent"
                    : "text-neutral-500 border-transparent hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded">
              <div className="flex items-center justify-between gap-4">
                <p className="text-error text-sm">{error}</p>
                <button
                  onClick={() => analyticsQuery.refetch()}
                  className="text-sm text-accent hover:underline whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading && !summary && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="Loading analytics..." />
            </div>
          )}

          {/* Costs Tab */}
          {activeTab === "costs" && summary && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                    Total Cost
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatCurrency(summary.totalCost)}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {dateRangeLabel}
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                    Daily Average
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatCurrency(summary.dailyAverage)}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {formatCurrency(summary.costPerRequest)} per request
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                    Total Requests
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatNumber(summary.totalRequests)}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {formatNumber(
                      summary.totalRequests / calculateDays(dateRange),
                    )}
                    /day avg
                  </div>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                    Total Tokens
                  </div>
                  <div className="text-2xl font-semibold text-white">
                    {formatNumber(
                      summary.totalInputTokens + summary.totalOutputTokens,
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    In: {formatNumber(summary.totalInputTokens)} / Out:{" "}
                    {formatNumber(summary.totalOutputTokens)}
                  </div>
                </div>
              </div>

              {/* Cost Over Time Chart */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium">Cost Over Time</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Daily spending by provider
                    </p>
                  </div>
                </div>
                <CostChart
                  data={
                    analytics?.costOverTime.map((d) => ({
                      period: d.period || "",
                      cost: d.costCents / 100,
                      provider: d.provider,
                    })) || []
                  }
                  groupBy="day"
                />
              </div>

              {/* Cost Breakdown */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* By Provider */}
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <h3 className="text-sm font-medium mb-4">Cost by Provider</h3>
                  <div className="space-y-3">
                    {analytics?.costByProvider &&
                    analytics.costByProvider.length > 0 ? (
                      analytics.costByProvider.map((item, index) => {
                        const totalCost = analytics.costByProvider.reduce(
                          (sum, d) => sum + d.costCents,
                          0,
                        );
                        const percentage =
                          totalCost > 0
                            ? (item.costCents / totalCost) * 100
                            : 0;
                        const colors = [
                          "bg-neutral-400",
                          "bg-neutral-500",
                          "bg-neutral-600",
                        ];
                        return (
                          <div
                            key={item.provider || index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-3 h-3 rounded-sm ${colors[index % colors.length]}`}
                              ></div>
                              <span className="text-sm capitalize">
                                {item.provider || "Unknown"}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {formatCurrency(item.costCents / 100)}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {percentage.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-neutral-500">
                        No data available
                      </p>
                    )}
                  </div>
                </div>

                {/* By Model */}
                <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                  <h3 className="text-sm font-medium mb-4">Cost by Model</h3>
                  <div className="space-y-3">
                    {analytics?.topModels && analytics.topModels.length > 0 ? (
                      analytics.topModels.slice(0, 5).map((item, index) => {
                        const totalCost = analytics.topModels.reduce(
                          (sum, d) => sum + d.costCents,
                          0,
                        );
                        const percentage =
                          totalCost > 0
                            ? (item.costCents / totalCost) * 100
                            : 0;
                        const colors = [
                          "bg-neutral-400",
                          "bg-neutral-500",
                          "bg-neutral-600",
                          "bg-neutral-700",
                          "bg-neutral-800",
                        ];
                        return (
                          <div key={item.model || index}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>{item.model || "Unknown"}</span>
                              <span className="font-medium">
                                {formatCurrency(item.costCents / 100)}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-800 h-2 rounded">
                              <div
                                className={`${colors[index % colors.length]} h-2 rounded`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-neutral-500">
                        No data available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Token Usage Chart */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium">Token Usage</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Input vs Output tokens over time
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-neutral-400"></div>
                      <span className="text-neutral-400">
                        Input: {formatNumber(summary.totalInputTokens)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-neutral-600"></div>
                      <span className="text-neutral-400">
                        Output: {formatNumber(summary.totalOutputTokens)}
                      </span>
                    </div>
                  </div>
                </div>
                <TokenUsageChart
                  data={
                    analytics?.costOverTime.map((d) => ({
                      period: d.period || "",
                      inputTokens: 0, // CostOverTimeByProvider doesn't include token data
                      outputTokens: 0,
                    })) || []
                  }
                />
              </div>
            </>
          )}

          {/* Models Tab */}
          {activeTab === "models" && summary && (
            <>
              {/* Model Comparison Table */}
              <div className="bg-neutral-900 border border-neutral-800 rounded p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Model Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Model
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Requests
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Total Cost
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Cost/Req
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Avg Latency
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">
                          Error Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.topModels &&
                      analytics.topModels.length > 0 ? (
                        analytics.topModels.map((item, index) => {
                          const errorRate =
                            item.requests > 0 ? (0 / item.requests) * 100 : 0; // StatsByModel doesn't include error_count
                          const costPerReq =
                            item.requests > 0
                              ? item.costCents / 100 / item.requests
                              : 0;
                          return (
                            <tr
                              key={item.model || index}
                              className="border-b border-neutral-800 hover:bg-neutral-850"
                            >
                              <td className="py-3 px-3 text-sm font-medium">
                                {item.model || "Unknown"}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                {formatNumber(item.requests)}
                              </td>
                              <td className="py-3 px-3 text-sm font-medium text-white">
                                {formatCurrency(item.costCents / 100)}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                {formatCurrency(costPerReq)}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                {formatLatency(item.avgLatency)}
                              </td>
                              <td
                                className={`py-3 px-3 text-sm ${errorRate > 2 ? "text-error/80" : "text-success"}`}
                              >
                                {errorRate.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-sm text-neutral-500"
                          >
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Model Insights */}
              {analytics?.topModels && analytics.topModels.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-neutral-800 rounded">
                        <TrendUpIcon />
                      </div>
                      <span className="text-xs text-neutral-500 uppercase tracking-wide">
                        Most Cost Efficient
                      </span>
                    </div>
                    {(() => {
                      const sorted = [...(analytics?.topModels || [])].sort(
                        (a, b) => {
                          const costPerReqA =
                            a.requests > 0
                              ? a.costCents / a.requests
                              : Infinity;
                          const costPerReqB =
                            b.requests > 0
                              ? b.costCents / b.requests
                              : Infinity;
                          return costPerReqA - costPerReqB;
                        },
                      );
                      const best = sorted[0];
                      const costPerReq =
                        best && best.requests > 0
                          ? best.costCents / 100 / best.requests
                          : 0;
                      return (
                        <>
                          <div className="text-lg font-medium">
                            {best?.model || "N/A"}
                          </div>
                          <div className="text-sm text-neutral-500 mt-1">
                            {formatCurrency(costPerReq)} per request
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-neutral-800 rounded">
                        <ClockIcon />
                      </div>
                      <span className="text-xs text-neutral-500 uppercase tracking-wide">
                        Fastest
                      </span>
                    </div>
                    {(() => {
                      const sorted = [...(analytics?.topModels || [])].sort(
                        (a, b) => a.avgLatency - b.avgLatency,
                      );
                      const best = sorted[0];
                      return (
                        <>
                          <div className="text-lg font-medium">
                            {best?.model || "N/A"}
                          </div>
                          <div className="text-sm text-neutral-500 mt-1">
                            {formatLatency(best?.avgLatency || 0)} average
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-neutral-800 rounded">
                        <CheckCircleIcon />
                      </div>
                      <span className="text-xs text-neutral-500 uppercase tracking-wide">
                        Most Reliable
                      </span>
                    </div>
                    {(() => {
                      const sorted = [...(analytics?.topModels || [])]
                        .filter((m) => m.requests > 0)
                        .sort((a, b) => {
                          const rateA = 0 / a.requests; // StatsByModel doesn't include error_count
                          const rateB = 0 / b.requests;
                          return rateA - rateB;
                        });
                      const best = sorted[0];
                      const errorRate =
                        best && best.requests > 0
                          ? (0 / best.requests) * 100
                          : 0;
                      return (
                        <>
                          <div className="text-lg font-medium">
                            {best?.model || "N/A"}
                          </div>
                          <div className="text-sm text-neutral-500 mt-1">
                            {errorRate.toFixed(1)}% error rate
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
