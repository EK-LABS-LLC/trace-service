import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface LatencyDataPoint {
  period: string;
  p50: number;
  p95: number;
  p99: number;
}

interface LatencyChartProps {
  data: LatencyDataPoint[];
}

function formatLatency(value: number): string {
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "s";
  }
  return value + "ms";
}

function formatPeriodLabel(period: string): string {
  if (period.includes("T") || period.includes("-")) {
    const date = new Date(period);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return period;
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    name: string;
  }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-neutral-850 border border-neutral-700 rounded px-3 py-2 shadow-xl">
      <p className="text-xs text-neutral-400 mb-1">
        {formatPeriodLabel(label || "")}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-neutral-300">{entry.name}:</span>
          <span className="font-medium text-white">
            {formatLatency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const PERCENTILE_COLORS = {
  p50: "#22c55e", // success green
  p95: "#f97316", // orange
  p99: "#ef4444", // error red
};

export default function LatencyChart({ data }: LatencyChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded">
        <p className="text-sm">No latency data available</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    period: formatPeriodLabel(d.period),
    P50: d.p50,
    P95: d.p95,
    P99: d.p99,
  }));

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1f1f1f"
            vertical={false}
          />
          <XAxis
            dataKey="period"
            stroke="#525252"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#1f1f1f" }}
            tick={{ fill: "#525252" }}
          />
          <YAxis
            stroke="#525252"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatLatency}
            tick={{ fill: "#525252" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{ paddingBottom: 10 }}
            formatter={(value) => (
              <span className="text-neutral-500 text-xs">{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="P50"
            name="P50"
            stroke={PERCENTILE_COLORS.p50}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: PERCENTILE_COLORS.p50 }}
          />
          <Line
            type="monotone"
            dataKey="P95"
            name="P95"
            stroke={PERCENTILE_COLORS.p95}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: PERCENTILE_COLORS.p95 }}
          />
          <Line
            type="monotone"
            dataKey="P99"
            name="P99"
            stroke={PERCENTILE_COLORS.p99}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: PERCENTILE_COLORS.p99 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
