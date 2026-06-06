import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MfApiResult } from "@/lib/data/mfapi";

vi.mock("@/lib/data/mfapi", () => ({ fetchScheme: vi.fn() }));

import { fetchScheme } from "@/lib/data/mfapi";
import { valueHolding, valueHoldings, type HeldFund } from "./valuation";

const mockFetch = vi.mocked(fetchScheme);

function scheme(nav: number, date = "2024-06-01"): MfApiResult {
  return { schemeCode: 1, name: "S", navHistory: [{ date, nav }] };
}

beforeEach(() => {
  mockFetch.mockReset();
});

const base: HeldFund = { id: "h1", units: 100, avgCostNav: 40, investedAmount: 4000, amfiCode: "120503" };

describe("valueHolding", () => {
  it("marks to market at the latest NAV", async () => {
    mockFetch.mockResolvedValue(scheme(50));
    const v = await valueHolding(base);
    expect(v.valued).toBe(true);
    expect(v.latestNav).toBe(50);
    expect(v.navDate).toBe("2024-06-01");
    expect(v.currentValue).toBe(5000);
    expect(v.gain).toBe(1000);
    expect(v.gainPct).toBeCloseTo(0.25, 5);
  });

  it("derives invested from units x avg cost when investedAmount is null", async () => {
    mockFetch.mockResolvedValue(scheme(45));
    const v = await valueHolding({ ...base, investedAmount: null });
    expect(v.invested).toBe(4000);
    expect(v.currentValue).toBe(4500);
    expect(v.gain).toBe(500);
  });

  it("falls back to cost when there is no scheme code", async () => {
    const v = await valueHolding({ ...base, amfiCode: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(v.valued).toBe(false);
    expect(v.latestNav).toBeNull();
    expect(v.currentValue).toBe(4000);
    expect(v.gain).toBe(0);
  });

  it("falls back to cost when the NAV fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("source down"));
    const v = await valueHolding(base);
    expect(v.valued).toBe(false);
    expect(v.currentValue).toBe(4000);
  });
});

describe("valueHoldings", () => {
  it("returns a map keyed by holding id", async () => {
    mockFetch.mockResolvedValue(scheme(50));
    const map = await valueHoldings([base, { ...base, id: "h2", units: 10 }]);
    expect(map.size).toBe(2);
    expect(map.get("h1")!.currentValue).toBe(5000);
    expect(map.get("h2")!.currentValue).toBe(500);
  });
});
