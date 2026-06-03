"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NavPoint } from "@/lib/data/types";

/** Underwater (drawdown-from-peak) series. */
function toDrawdown(history: NavPoint[], target = 250) {
  let peak = -Infinity;
  const dd = history.map((p) => {
    if (p.nav > peak) peak = p.nav;
    return { date: p.date, dd: peak > 0 ? -((peak - p.nav) / peak) * 100 : 0 };
  });
  if (dd.length <= target) return dd;
  const step = Math.ceil(dd.length / target);
  return dd.filter((_, i) => i % step === 0);
}

export function DrawdownChart({ history }: { history: NavPoint[] }) {
  const data = toDrawdown(history);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          minTickGap={48}
          tickFormatter={(d: string) => d.slice(0, 7)}
        />
        <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [`${v.toFixed(1)}%`, "Drawdown"]}
        />
        <Area type="monotone" dataKey="dd" stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="url(#ddFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
