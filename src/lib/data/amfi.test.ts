import { describe, expect, it } from "vitest";
import { parseNavAll } from "./amfi";

const SAMPLE = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Flexi Cap Fund)
PPFAS Mutual Fund
122639;INF879O01027;-;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;65.4321;06-Jun-2026
122640;INF879O01035;INF879O01043;Parag Parikh Flexi Cap Fund - Regular Plan - IDCW;55.1;06-Jun-2026

Open Ended Schemes(Debt Scheme - Liquid Fund)
Some AMC Mutual Fund
100001;INF000A01010;-;Some Liquid Fund - Direct Plan - Growth;1000.5;06-Jun-2026
`;

describe("parseNavAll", () => {
  const entries = parseNavAll(SAMPLE);

  it("parses all data rows and skips the header", () => {
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.schemeCode)).toEqual([122639, 122640, 100001]);
  });

  it("captures identity, category, plan and kind for a direct-growth fund", () => {
    const e = entries[0];
    expect(e.name).toMatch(/Parag Parikh Flexi Cap/);
    expect(e.amc).toBe("PPFAS Mutual Fund");
    expect(e.categoryRaw).toBe("Equity Scheme - Flexi Cap Fund");
    expect(e.category).toBe("flexicap");
    expect(e.assetClass).toBe("equity");
    expect(e.isin).toBe("INF879O01027");
    expect(e.plan).toBe("direct");
    expect(e.kind).toBe("growth");
    expect(e.latestNav).toBeCloseTo(65.4321, 4);
    expect(e.navDate).toBe("06-Jun-2026");
  });

  it("detects regular / idcw plans", () => {
    expect(entries[1].plan).toBe("regular");
    expect(entries[1].kind).toBe("idcw");
    expect(entries[1].isin).toBe("INF879O01035");
  });

  it("tracks the category/AMC group switch and maps debt", () => {
    const e = entries[2];
    expect(e.amc).toBe("Some AMC Mutual Fund");
    expect(e.category).toBe("liquid");
    expect(e.assetClass).toBe("debt");
  });
});
