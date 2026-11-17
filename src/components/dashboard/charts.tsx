"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type VolumePoint = { day: string; live: number };

export function SignalVolumeChart({ data }: { data: VolumePoint[] }) {
  return (
    <div className="h-[150px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 2, left: -30, bottom: 0 }} barCategoryGap="26%">
          <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(148,163,184,0.55)", fontSize: 9, fontFamily: "var(--font-geist-mono)" }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 9, fontFamily: "var(--font-geist-mono)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={30}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "#0c1117",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 11,
              color: "#e7edf4",
              padding: "6px 10px",
            }}
            labelStyle={{ color: "rgba(148,163,184,0.7)", fontSize: 10 }}
            formatter={(value) => [value ?? 0, "Signals"]}
          />
          <Bar dataKey="live" stackId="a" fill="#b8f26a" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ScorePoint = { name: string; icp: number; signal: number };

export function ScoreDistribution({ data }: { data: ScorePoint[] }) {
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="score-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8f26a" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#b8f26a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
          <XAxis dataKey="name" hide />
          <YAxis domain={[0, 100]} tick={{ fill: "rgba(148,163,184,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: "#0c1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
            formatter={(value, name) => [value ?? 0, name === "icp" ? "ICP-fit" : "Signal"]}
          />
          <Area type="monotone" dataKey="signal" stroke="#b8f26a" strokeWidth={1.5} fill="url(#score-gradient)" />
          <Area type="monotone" dataKey="icp" stroke="#5eead4" strokeWidth={1} strokeDasharray="3 3" fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
