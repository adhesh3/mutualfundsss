import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, formatPct, formatNumber, formatDate } from "./format";

describe("formatINR", () => {
  it("formats rupees with no decimals by default", () => {
    expect(formatINR(1234)).toContain("1,234");
    expect(formatINR(1234)).toContain("₹");
  });
  it("supports precise (2-decimal) mode", () => {
    expect(formatINR(65.4, true)).toContain("65.40");
  });
  it("returns -- for null/NaN", () => {
    expect(formatINR(null)).toBe("--");
    expect(formatINR(undefined)).toBe("--");
    expect(formatINR(NaN)).toBe("--");
  });
});

describe("formatINRCompact", () => {
  it("uses Cr / L / K boundaries", () => {
    expect(formatINRCompact(2_50_00_000)).toBe("2.50 Cr");
    expect(formatINRCompact(3_50_000)).toBe("3.50 L");
    expect(formatINRCompact(4_500)).toBe("4.5 K");
    expect(formatINRCompact(500)).toBe("500");
  });
  it("returns -- for null/NaN", () => {
    expect(formatINRCompact(null)).toBe("--");
    expect(formatINRCompact(NaN)).toBe("--");
  });
});

describe("formatPct", () => {
  it("treats input as a ratio by default", () => {
    expect(formatPct(0.123)).toBe("12.3%");
  });
  it("respects isRatio:false (already a percent)", () => {
    expect(formatPct(12.3, { isRatio: false })).toBe("12.3%");
  });
  it("adds a + sign for positive values when withSign", () => {
    expect(formatPct(0.05, { withSign: true })).toBe("+5.0%");
    expect(formatPct(-0.05, { withSign: true })).toBe("-5.0%");
  });
  it("honours digits", () => {
    expect(formatPct(0.12345, { digits: 2 })).toBe("12.35%");
  });
  it("returns -- for null/NaN", () => {
    expect(formatPct(null)).toBe("--");
    expect(formatPct(NaN)).toBe("--");
  });
});

describe("formatNumber", () => {
  it("rounds to given digits", () => {
    expect(formatNumber(1.23456)).toBe("1.23");
    expect(formatNumber(1.23456, 1)).toBe("1.2");
  });
  it("returns -- for null/NaN", () => {
    expect(formatNumber(undefined)).toBe("--");
    expect(formatNumber(NaN)).toBe("--");
  });
});

describe("formatDate", () => {
  it("formats ISO strings as dd Mon yyyy", () => {
    expect(formatDate("2024-03-09")).toMatch(/09 Mar 2024/);
  });
  it("returns -- for empty/invalid", () => {
    expect(formatDate(null)).toBe("--");
    expect(formatDate("not-a-date")).toBe("--");
  });
});
