"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NavPoint } from "@/lib/data/types";

/** Downsample a long daily series to ~250 points for a snappy chart. */
function downsample(history: NavPoint[], target = 250): NavPoint[] {
  if (history.length <= target) return history;
  const step = Math.ceil(history.length / target);
  const out = history.filter((_, i) => i % step === 0);
  if (out.at(-1) !== history.at(-1)) out.push(history.at(-1)!);
  return out;
}

export function NavChart({ history }: { history: NavPoint[] }) {
  const data = downsample(history).map((p) => ({ date: p.date, nav: p.nav }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="navFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={48} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [v.toFixed(2), "NAV"]}
        />
        <Area type="monotone" dataKey="nav" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#navFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
