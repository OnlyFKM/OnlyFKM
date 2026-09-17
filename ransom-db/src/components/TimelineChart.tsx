"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function TimelineChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="h-64 rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted mb-2">
        Disclosed victims over time
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#232a35" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#8b93a3", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#232a35" }}
            minTickGap={40}
          />
          <YAxis tick={{ fill: "#8b93a3", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#171c25",
              border: "1px solid #232a35",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e6e9ef" }}
          />
          <Area type="monotone" dataKey="count" stroke="#ef4444" fill="url(#fillCount)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
