import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface ErrorRateDataPoint {
  period: string;
  errorRate: number;
  errorCount: number;
  totalRequests: number;
}

interface ErrorRateChartProps {
  data: ErrorRateDataPoint[];
  threshold?: number;
}

function formatPercentage(value: number): string {
  return value.toFixed(1) + "%";
}

function formatPeriodLabel(period: string): string {
  if (period.includes("T") || period.includes("-")) {
    const date = new Date(period);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return period;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ErrorRateDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-neutral-850 border border-neutral-700 rounded px-3 py-2 shadow-xl">
      <p className="text-xs text-neutral-400 mb-1">
        {formatPeriodLabel(label || "")}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-sm bg-error" />
        <span className="text-neutral-300">Error Rate:</span>
        <span className="font-medium text-white">
          {formatPercentage(data.errorRate)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm mt-1">
        <div className="w-2 h-2 rounded-sm bg-neutral-600" />
        <span className="text-neutral-300">Errors:</span>
        <span className="font-medium text-white">
          {data.errorCount} / {data.totalRequests}
        </span>
      </div>
    </div>
  );
}

export default function ErrorRateChart({
  data,
  threshold = 5,
}: ErrorRateChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded">
        <p className="text-sm">No error rate data available</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    period: formatPeriodLabel(d.period),
  }));

  const maxErrorRate = Math.max(...data.map((d) => d.errorRate), threshold);
  const yAxisMax = Math.ceil(maxErrorRate * 1.2);

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
            tickFormatter={formatPercentage}
            tick={{ fill: "#525252" }}
            domain={[0, yAxisMax]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={threshold}
            stroke="#f97316"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{
              value: `${threshold}% threshold`,
              position: "right",
              fill: "#f97316",
              fontSize: 10,
            }}
          />
          <defs>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="errorRate"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const isSpike = payload.errorRate > threshold;
              if (!isSpike)
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} />;
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill="#ef4444"
                  stroke="#0a0a0a"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{
              r: 4,
              fill: "#ef4444",
              stroke: "#0a0a0a",
              strokeWidth: 2,
            }}
            fill="url(#errorGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
