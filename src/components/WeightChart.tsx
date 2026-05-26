"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeightPoint = {
  /** Epoch ms — kept numeric so the axis spaces points by real time. */
  t: number;
  /** Weight in the user's display unit. */
  value: number;
};

// Minimal B&W trend line. Mobile-first: fills its container width.
export default function WeightChart({
  data,
  unit,
}: {
  data: WeightPoint[];
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
            tickFormatter={formatTick}
            tick={{ fontSize: 12, fill: "#71717a" }}
            stroke="#d4d4d8"
            minTickGap={32}
          />
          <YAxis
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={{ fontSize: 12, fill: "#71717a" }}
            stroke="#d4d4d8"
            width={40}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            formatter={(v) => [`${v} ${unit}`, "Weight"]}
            labelFormatter={(t) => formatFull(Number(t))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#000000"
            strokeWidth={2}
            dot={{ r: 3, fill: "#000000" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTick(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFull(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
