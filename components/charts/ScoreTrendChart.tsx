"use client";

import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type TrendPoint = {
  date: string;
  score: number;
};

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="text-stone-500">{label}</p>
      <p className="font-semibold text-brand-500">{payload[0].value} de 5</p>
    </div>
  );
}

export default function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke="#e7e5e4" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#78716c" }}
          axisLine={{ stroke: "#e7e5e4" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 5]}
          tick={{ fontSize: 12, fill: "#78716c" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<TrendTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#f24444"
          strokeWidth={2}
          dot={{ r: 4, fill: "#f24444", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
