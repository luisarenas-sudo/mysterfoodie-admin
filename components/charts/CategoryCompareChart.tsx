"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export type CategoryComparePoint = {
  label: string;
  actual: number;
  anterior?: number;
};

function CompareTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card px-3 py-2 text-sm shadow-sm">
      <p className="mb-1 text-stone-600">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value} de 5
        </p>
      ))}
    </div>
  );
}

export default function CategoryCompareChart({
  data,
  showPrevious,
}: {
  data: CategoryComparePoint[];
  showPrevious: boolean;
}) {
  const height = Math.max(220, data.length * 38);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        barGap={2}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid horizontal={false} stroke="#e7e5e4" strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 5]}
          tick={{ fontSize: 12, fill: "#78716c" }}
          axisLine={{ stroke: "#e7e5e4" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={230}
          tick={{ fontSize: 11, fill: "#222222" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CompareTooltip />} cursor={{ fill: "#f5f5f4" }} />
        {showPrevious && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {showPrevious && (
          <Bar
            dataKey="anterior"
            name="Visita anterior"
            fill="#fbd0ca"
            radius={[0, 4, 4, 0]}
            barSize={12}
          />
        )}
        <Bar
          dataKey="actual"
          name="Visita actual"
          fill="#f24444"
          radius={[0, 4, 4, 0]}
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
