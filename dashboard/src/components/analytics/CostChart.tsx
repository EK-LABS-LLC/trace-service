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
import { getProviderColor } from "../../lib/providerUtils";

export interface CostDataPoint {
  period: string;
  cost: number;
  provider?: string;
}

interface CostChartProps {
  data: CostDataPoint[];
  groupBy?: "day" | "hour" | "provider";
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return "$" + (value / 1000).toFixed(1) + "K";
  }
  return "$" + value.toFixed(2);
}

function formatPeriodLabel(period: string): string {
  // Handle ISO date strings
  if (period.includes("T") || period.includes("-")) {
    const date = new Date(period);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return period;
}

// Group data by provider for multi-line chart
function groupDataByProvider(data: CostDataPoint[]): {
  periods: string[];
  series: Record<string, number[]>;
} {
  const periodMap = new Map<string, Record<string, number>>();
  const providers = new Set<string>();

  for (const point of data) {
    const provider = point.provider || "Unknown";
    providers.add(provider);

    if (!periodMap.has(point.period)) {
      periodMap.set(point.period, {});
    }
    periodMap.get(point.period)![provider] = point.cost;
  }

  const periods = Array.from(periodMap.keys()).sort();
  const series: Record<string, number[]> = {};

  for (const provider of providers) {
    series[provider] = periods.map((p) => periodMap.get(p)?.[provider] || 0);
  }

  return { periods, series };
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
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
          <span className="capitalize text-neutral-300">{entry.dataKey}:</span>
          <span className="font-medium text-white">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CostChart({ data, groupBy = "day" }: CostChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded">
        <p className="text-sm">No cost data available</p>
      </div>
    );
  }

  // Check if data has provider information
  const hasProviders = data.some((d) => d.provider);

  if (hasProviders && groupBy !== "provider") {
    // Multi-line chart by provider
    const { periods, series } = groupDataByProvider(data);
    const chartData = periods.map((period, i) => {
      const point: Record<string, string | number> = {
        period: formatPeriodLabel(period),
      };
      for (const [provider, values] of Object.entries(series)) {
        point[provider] = values[i];
      }
      return point;
    });

    const providers = Object.keys(series);

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
              tickFormatter={formatCurrency}
              tick={{ fill: "#525252" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              align="right"
              verticalAlign="top"
              wrapperStyle={{ paddingBottom: 10 }}
              formatter={(value) => (
                <span className="text-neutral-500 text-xs capitalize">
                  {value}
                </span>
              )}
            />
            {providers.map((provider) => (
              <Line
                key={provider}
                type="monotone"
                dataKey={provider}
                stroke={getProviderColor(provider)}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: getProviderColor(provider) }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Single line chart (aggregated or provider-grouped)
  const chartData = data.map((d) => ({
    period: formatPeriodLabel(d.period),
    cost: d.cost,
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
            tickFormatter={formatCurrency}
            tick={{ fill: "#525252" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Line
            type="monotone"
            dataKey="cost"
            stroke="#34d399"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: "#34d399" }}
            fill="url(#costGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
