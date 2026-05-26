"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from "recharts";

export type ProgressPoint = {
  t: number; // epoch ms
  value: number; // top-set weight in display units
  isPr: boolean;
};

// Top-set weight over time. PR points are drawn as a larger hollow ring so the
// moments a record was set stand out.
export default function ExerciseProgressChart({
  data,
  unit,
}: {
  data: ProgressPoint[];
  unit: string;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t: number) =>
              new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            tick={{ fontSize: 12, fill: "#71717a" }}
            stroke="#d4d4d8"
            minTickGap={32}
          />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fontSize: 12, fill: "#71717a" }}
            stroke="#d4d4d8"
            width={40}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            formatter={(v, _n, item) => [
              `${v} ${unit}${(item?.payload as ProgressPoint)?.isPr ? "  · PR" : ""}`,
              "Top set",
            ]}
            labelFormatter={(t) =>
              new Date(Number(t)).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            }
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#000000"
            strokeWidth={2}
            isAnimationActive={false}
            dot={<PrDot />}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PrDot(props: DotProps & { payload?: ProgressPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  if (payload?.isPr) {
    return <circle cx={cx} cy={cy} r={5} fill="#ffffff" stroke="#000000" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#000000" />;
}
