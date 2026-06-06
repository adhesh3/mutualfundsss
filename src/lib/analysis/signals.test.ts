import { describe, expect, it } from "vitest";
import type { NavPoint } from "@/lib/data/types";
import type { FundAnalysis } from "./analyze";
import type { Verdict } from "./recommend";
import { currentDrawdown, buySignalFor, maturityReminders } from "./signals";

function analysis(navHistory: NavPoint[], verdict: Verdict, mode = "SIP", score = 70): FundAnalysis {
  return {
    profile: { identity: { name: "Test Fund" }, navHistory } as FundAnalysis["profile"],
    metrics: {} as FundAnalysis["metrics"],
    recommendation: {
      verdict,
      score,
      mode: { recommendation: mode },
    } as FundAnalysis["recommendation"],
    sipVsLumpsum: null,
  };
}

const series = (peak: number, last: number): NavPoint[] => [
  { date: "2024-01-01", nav: peak },
  { date: "2024-06-01", nav: last },
];

describe("currentDrawdown", () => {
  it("measures how far below peak the latest NAV is", () => {
    expect(currentDrawdown(series(100, 80))).toBeCloseTo(0.2, 5);
  });
  it("is zero at a new high", () => {
    expect(currentDrawdown(series(90, 100))).toBe(0);
  });
  it("is zero with too little data", () => {
    expect(currentDrawdown([{ date: "2024-01-01", nav: 100 }])).toBe(0);
  });
});

describe("buySignalFor", () => {
  it("returns null when not far enough off peak", () => {
    expect(buySignalFor(123, analysis(series(100, 96), "Buy"))).toBeNull();
  });

  it("returns null for Avoid-rated funds even when down hard", () => {
    expect(buySignalFor(123, analysis(series(100, 60), "Avoid"))).toBeNull();
  });

  it("flags a watch-level signal between 10% and 20%", () => {
    const s = buySignalFor(123, analysis(series(100, 87), "Buy"));
    expect(s).not.toBeNull();
    expect(s!.strength).toBe("watch");
    expect(s!.schemeCode).toBe(123);
  });

  it("flags a strong signal beyond 20% with a mode-aware message", () => {
    const s = buySignalFor(123, analysis(series(100, 75), "Buy", "SIP"));
    expect(s).not.toBeNull();
    expect(s!.strength).toBe("strong");
    expect(s!.message).toMatch(/stepping up your SIP/i);
  });
});

describe("maturityReminders", () => {
  const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);
  const inst = (id: string, days: number) => ({ id, name: id, principal: 1000, maturityDate: daysFromNow(days) });

  it("includes only instruments maturing within the window, soonest first", () => {
    const out = maturityReminders(
      [inst("far", 200), inst("soon", 10), inst("mid", 60), inst("past", -5), { id: "none", name: "none", principal: 1, maturityDate: null }],
      90,
    );
    expect(out.map((m) => m.id)).toEqual(["soon", "mid"]);
    expect(out[0].daysToMaturity).toBeGreaterThan(0);
    expect(out[0].daysToMaturity).toBeLessThanOrEqual(11);
  });
});
