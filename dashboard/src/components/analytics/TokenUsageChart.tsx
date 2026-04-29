import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface TokenDataPoint {
  period: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
}

interface TokenUsageChartProps {
  data: TokenDataPoint[];
  groupBy?: "day" | "hour" | "model";
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
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

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

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
            {formatNumber(entry.value)}
          </span>
        </div>
      ))}
      <div className="border-t border-neutral-700 mt-1 pt-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Total:</span>
          <span className="font-medium text-white">{formatNumber(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function TokenUsageChart({ data }: TokenUsageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded">
        <p className="text-sm">No token data available</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    period: formatPeriodLabel(d.period),
    "Input Tokens": d.inputTokens,
    "Output Tokens": d.outputTokens,
  }));

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
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
            tickFormatter={formatNumber}
            tick={{ fill: "#525252" }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{ paddingBottom: 10 }}
            formatter={(value) => (
              <span className="text-neutral-500 text-xs">{value}</span>
            )}
          />
          <Bar
            dataKey="Input Tokens"
            stackId="tokens"
            fill="#34d399"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="Output Tokens"
            stackId="tokens"
            fill="#fb923c"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
