import { describe, expect, it } from "vitest";
import { parseHoldingsCsv, escapeCsvCell, toCsvRow } from "./holdings-csv";

describe("parseHoldingsCsv", () => {
  it("parses valid rows and skips a header", () => {
    const { rows, errors } = parseHoldingsCsv("amfiCode,units,avgCostNav\n120503,250.5,42.1\n119598,100,65.4");
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      { schemeCode: 120503, units: 250.5, avgCostNav: 42.1 },
      { schemeCode: 119598, units: 100, avgCostNav: 65.4 },
    ]);
  });

  it("parses without a header row", () => {
    const { rows } = parseHoldingsCsv("120503,10,42.1");
    expect(rows).toHaveLength(1);
    expect(rows[0].schemeCode).toBe(120503);
  });

  it("ignores blank lines and trims whitespace", () => {
    const { rows } = parseHoldingsCsv("\n 120503 , 10 , 42.1 \n\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(10);
  });

  it("reports invalid codes and amounts with row numbers", () => {
    const { rows, errors } = parseHoldingsCsv("120503,10,42.1\nabc,10,5\n120999,-1,5\n120999,10,0");
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/Row 2: invalid AMFI code/);
    expect(errors[1]).toMatch(/Row 3: invalid units/);
    expect(errors[2]).toMatch(/Row 4: invalid units/);
  });
});

describe("escapeCsvCell / toCsvRow", () => {
  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("renders null/undefined as empty and joins a row", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(toCsvRow([120503, "HDFC, Flexi", null, 42.1])).toBe('120503,"HDFC, Flexi",,42.1');
  });
});
