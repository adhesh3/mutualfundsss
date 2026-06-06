import { describe, expect, it } from "vitest";
import { classifyCategory, assetClassFor } from "./categorize";

describe("classifyCategory", () => {
  it("maps explicit equity sub-categories", () => {
    expect(classifyCategory("ELSS Tax Saver")).toBe("elss");
    expect(classifyCategory("Small Cap Fund")).toBe("smallcap");
    expect(classifyCategory("Mid Cap Fund")).toBe("midcap");
    expect(classifyCategory("Large Cap / Bluechip")).toBe("largecap");
    expect(classifyCategory("Flexi Cap Fund")).toBe("flexicap");
    expect(classifyCategory("Multi Cap Fund")).toBe("flexicap");
  });

  it("maps index/ETF variants", () => {
    expect(classifyCategory("Nifty 50 Index Fund")).toBe("index");
    expect(classifyCategory("Sensex ETF")).toBe("index");
  });

  it("maps debt sub-categories", () => {
    expect(classifyCategory("Liquid Fund")).toBe("liquid");
    expect(classifyCategory("Overnight Fund")).toBe("liquid");
    expect(classifyCategory("Corporate Bond Fund")).toBe("corporate");
    expect(classifyCategory("Banking and PSU")).toBe("corporate");
    expect(classifyCategory("Gilt Fund")).toBe("gilt");
    expect(classifyCategory("Short Duration Fund")).toBe("short_duration");
    expect(classifyCategory("Ultra Short Term")).toBe("short_duration");
  });

  it("maps hybrid and generic fallbacks", () => {
    expect(classifyCategory("Aggressive Hybrid Fund")).toBe("hybrid");
    expect(classifyCategory("Balanced Advantage")).toBe("hybrid");
    expect(classifyCategory("Banking Debt Income")).toBe("short_duration");
    expect(classifyCategory("Pure Equity Scheme")).toBe("flexicap");
  });

  it("falls back to other for unknown/empty", () => {
    expect(classifyCategory(undefined)).toBe("other");
    expect(classifyCategory("")).toBe("other");
    expect(classifyCategory("Mystery Fund")).toBe("other");
  });
});

describe("assetClassFor", () => {
  it("overrides to gold for commodity raw labels", () => {
    expect(assetClassFor("other", "Gold ETF")).toBe("gold");
    expect(assetClassFor("index", "Silver Fund")).toBe("gold");
    expect(assetClassFor("other", "Commodities Fund")).toBe("gold");
  });
  it("maps category -> asset class otherwise", () => {
    expect(assetClassFor("smallcap")).toBe("equity");
    expect(assetClassFor("gilt")).toBe("debt");
    expect(assetClassFor("hybrid")).toBe("hybrid");
    expect(assetClassFor("other")).toBe("other");
  });
});
