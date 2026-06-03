import { describe, expect, it } from "vitest";
import type { NavPoint } from "@/lib/data/types";
import {
  adjustForRestatements,
  cagr,
  cleanNavSeries,
  computeMetrics,
  maxDrawdown,
  navAsOf,
  rollingReturns,
  sipVsLumpsum,
  xirr,
} from "./metrics";

/** Build a daily NAV series growing at a constant annual rate from a start date. */
function constantGrowthSeries(startIso: string, days: number, annualRate: number, startNav = 100): NavPoint[] {
  const dailyFactor = Math.pow(1 + annualRate, 1 / 365.25);
  const out: NavPoint[] = [];
  let nav = startNav;
  const start = new Date(startIso).getTime();
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date, nav: Number(nav.toFixed(6)) });
    nav *= dailyFactor;
  }
  return out;
}

describe("cagr", () => {
  it("doubles over ~1 year => ~100%", () => {
    expect(cagr(100, 200, 1)).toBeCloseTo(1, 5);
  });
  it("handles multi-year", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 5);
  });
});

describe("navAsOf", () => {
  const h: NavPoint[] = [
    { date: "2023-01-01", nav: 10 },
    { date: "2023-02-01", nav: 11 },
    { date: "2023-03-01", nav: 12 },
  ];
  it("returns the last point on or before the date", () => {
    expect(navAsOf(h, "2023-02-15")?.nav).toBe(11);
  });
  it("returns undefined before the first point", () => {
    expect(navAsOf(h, "2022-12-31")).toBeUndefined();
  });
});

describe("maxDrawdown", () => {
  it("captures peak-to-trough", () => {
    const h: NavPoint[] = [
      { date: "2023-01-01", nav: 100 },
      { date: "2023-01-02", nav: 120 },
      { date: "2023-01-03", nav: 60 }, // -50% from peak 120
      { date: "2023-01-04", nav: 90 },
    ];
    expect(maxDrawdown(h)).toBeCloseTo(0.5, 5);
  });
});

describe("xirr", () => {
  it("recovers a simple one-year doubling as ~100%", () => {
    const rate = xirr([
      { date: "2023-01-01", amount: -1000 },
      { date: "2024-01-01", amount: 2000 },
    ]);
    expect(rate).toBeCloseTo(1, 1);
  });
});

describe("computeMetrics on a 10% constant-growth series", () => {
  const series = constantGrowthSeries("2018-01-01", 365 * 6, 0.1);
  const m = computeMetrics(series);

  it("recovers ~10% since-inception CAGR", () => {
    expect(m.trailing.sinceInceptionCagr).toBeCloseTo(0.1, 2);
  });
  it("has near-zero volatility for a smooth series", () => {
    expect(m.annualizedVolatility ?? 1).toBeLessThan(0.01);
  });
  it("has near-zero drawdown for a monotonic series", () => {
    expect(m.maxDrawdown ?? 1).toBeLessThan(1e-6);
  });
  it("produces rolling 3y stats that are all positive", () => {
    const r = rollingReturns(series, 3);
    expect(r).not.toBeNull();
    expect(r!.pctPositive).toBe(1);
    expect(r!.avg).toBeCloseTo(0.1, 1);
  });
});

describe("restatement adjustment", () => {
  it("splices out a persistent ~10x NAV jump so it doesn't spike volatility", () => {
    // ~10 level for 5 days, then a 10x restatement to ~100 that persists.
    const raw: NavPoint[] = [
      { date: "2009-10-26", nav: 10.0 },
      { date: "2009-10-27", nav: 10.01 },
      { date: "2009-10-28", nav: 10.02 },
      { date: "2009-10-29", nav: 10.03 },
      { date: "2009-10-30", nav: 10.04 },
      { date: "2009-11-02", nav: 100.4 },
      { date: "2009-11-03", nav: 100.5 },
      { date: "2009-11-04", nav: 100.6 },
    ];
    const adj = adjustForRestatements(raw);
    // Latest NAV preserved; older points scaled up onto the new ~100 level.
    expect(adj.at(-1)!.nav).toBeCloseTo(100.6, 3);
    expect(adj[0].nav).toBeCloseTo(100.0, 1);
    // No remaining >40% day-over-day move.
    const clean = cleanNavSeries(raw);
    for (let i = 1; i < clean.length; i++) {
      expect(Math.abs(clean[i].nav / clean[i - 1].nav - 1)).toBeLessThan(0.4);
    }
  });

  it("leaves a clean series unchanged", () => {
    const series = constantGrowthSeries("2020-01-01", 400, 0.1);
    const adj = adjustForRestatements(series);
    expect(adj.at(-1)!.nav).toBeCloseTo(series.at(-1)!.nav, 5);
    expect(adj[0].nav).toBeCloseTo(series[0].nav, 5);
  });
});

describe("sipVsLumpsum", () => {
  it("on a steadily rising series, lumpsum beats SIP (more time in market)", () => {
    const series = constantGrowthSeries("2019-01-01", 365 * 6, 0.12);
    const res = sipVsLumpsum(series, 5, 10_000);
    expect(res).not.toBeNull();
    expect(res!.lumpsumFinalValue).toBeGreaterThan(res!.sipFinalValue);
    expect(res!.sipXirr).toBeGreaterThan(0);
  });
});
