import { describe, expect, it } from "vitest";
import type { Fund } from "@prisma/client";
import { nfoWindowStatus, buildNfoProfile } from "./nfo";

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

function fund(over: Partial<Fund>): Fund {
  return {
    id: "f1",
    amfiCode: null,
    isin: null,
    name: "XYZ Innovation Fund",
    amc: "XYZ MF",
    category: "flexicap",
    assetClass: null,
    isNfo: true,
    nfoOpen: null,
    nfoClose: null,
    nfoMandate: null,
    nfoTerPct: null,
    fundManager: null,
    benchmarkSchemeCode: null,
    notes: null,
    isWatched: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Fund;
}

describe("nfoWindowStatus", () => {
  it("returns Unknown when no dates are set", () => {
    expect(nfoWindowStatus(fund({})).label).toBe("Unknown");
  });
  it("returns Upcoming before the open date", () => {
    expect(nfoWindowStatus(fund({ nfoOpen: daysFromNow(5) })).label).toBe("Upcoming");
  });
  it("returns Closed after the close date", () => {
    expect(nfoWindowStatus(fund({ nfoOpen: daysFromNow(-20), nfoClose: daysFromNow(-5) })).label).toBe("Closed");
  });
  it("returns Open within the window", () => {
    expect(nfoWindowStatus(fund({ nfoOpen: daysFromNow(-2), nfoClose: daysFromNow(5) })).label).toBe("Open");
  });
});

describe("buildNfoProfile", () => {
  it("derives asset class from category and carries the stated TER", () => {
    const p = buildNfoProfile(fund({ category: "smallcap", nfoTerPct: 1.8 }));
    expect(p.identity.category).toBe("smallcap");
    expect(p.identity.assetClass).toBe("equity");
    expect(p.ratios.expenseRatio).toBe(1.8);
    expect(p.navHistory).toHaveLength(0);
  });

  it("includes window status and mandate in warnings", () => {
    const p = buildNfoProfile(
      fund({ nfoOpen: daysFromNow(-1), nfoClose: daysFromNow(5), nfoMandate: "Global tech equities" }),
    );
    expect(p.warnings.some((w) => /NFO status: Open/.test(w))).toBe(true);
    expect(p.warnings.some((w) => /Global tech equities/.test(w))).toBe(true);
  });
});
