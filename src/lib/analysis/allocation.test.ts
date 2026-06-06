import { describe, expect, it } from "vitest";
import {
  suggestTargetAllocation,
  computeAllocation,
  suggestedDebtCategories,
  type AllocationPosition,
} from "./allocation";

describe("suggestTargetAllocation", () => {
  it("uses the risk base for a long horizon and sums to 100", () => {
    const a = suggestTargetAllocation({ riskTolerance: "moderate", horizonYears: 7 });
    expect(a.equityPct).toBe(60);
    expect(a.goldPct).toBe(10);
    expect(a.equityPct + a.debtPct + a.goldPct).toBe(100);
  });

  it("caps equity hard for short horizons", () => {
    expect(suggestTargetAllocation({ riskTolerance: "aggressive", horizonYears: 2 }).equityPct).toBe(20);
    expect(suggestTargetAllocation({ riskTolerance: "aggressive", horizonYears: 4 }).equityPct).toBe(45);
  });

  it("boosts equity for very long horizons", () => {
    const a = suggestTargetAllocation({ riskTolerance: "aggressive", horizonYears: 12 });
    expect(a.equityPct).toBe(90);
    expect(a.goldPct).toBe(5);
    expect(a.debtPct).toBe(5);
  });

  it("blends with the 110-age heuristic when age is known", () => {
    // base 60, ageEquity = 110 - 30 = 80, average = 70
    const a = suggestTargetAllocation({ riskTolerance: "moderate", horizonYears: 7, age: 30 });
    expect(a.equityPct).toBe(70);
    expect(a.equityPct + a.debtPct + a.goldPct).toBe(100);
  });
});

describe("computeAllocation", () => {
  it("groups equity + hybrid into equityLike and flags drift", () => {
    const positions: AllocationPosition[] = [
      { assetClass: "equity", amount: 60 },
      { assetClass: "hybrid", amount: 10 },
      { assetClass: "debt", amount: 30 },
    ];
    const drift = computeAllocation(positions, { equityPct: 60, debtPct: 30, goldPct: 10 });
    expect(drift.total).toBe(100);
    expect(drift.current.equity).toBeCloseTo(70, 5);
    expect(drift.current.debt).toBeCloseTo(30, 5);
    // equity 70 vs 60 (+10) and gold 0 vs 10 (-10) both exceed the 7pt threshold
    expect(drift.nudges.length).toBeGreaterThanOrEqual(2);
    expect(drift.nudges.some((n) => /Equity/.test(n))).toBe(true);
  });

  it("produces no nudges when within threshold", () => {
    const positions: AllocationPosition[] = [
      { assetClass: "equity", amount: 60 },
      { assetClass: "debt", amount: 32 },
      { assetClass: "gold", amount: 8 },
    ];
    const drift = computeAllocation(positions, { equityPct: 60, debtPct: 30, goldPct: 10 });
    expect(drift.nudges).toHaveLength(0);
  });

  it("handles an empty portfolio", () => {
    const drift = computeAllocation([], { equityPct: 60, debtPct: 30, goldPct: 10 });
    expect(drift.total).toBe(0);
    expect(drift.current.equity).toBe(0);
    expect(drift.nudges).toHaveLength(0);
  });
});

describe("suggestedDebtCategories", () => {
  it("recommends by horizon bucket", () => {
    expect(suggestedDebtCategories(0.5).categories).toContain("Liquid");
    expect(suggestedDebtCategories(2).categories).toContain("Short Duration");
    expect(suggestedDebtCategories(4).categories).toContain("Banking & PSU");
    expect(suggestedDebtCategories(8).categories).toContain("Gilt");
  });
});
