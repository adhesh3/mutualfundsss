/** Pure helpers for the holdings CSV import/export (no DB or network here). */

export interface ParsedHoldingRow {
  schemeCode: number;
  units: number;
  avgCostNav: number;
}

export interface ParseHoldingsResult {
  rows: ParsedHoldingRow[];
  errors: string[];
}

/**
 * Parse holdings CSV text. Each row is `amfiCode,units,avgCostNav`. A leading
 * header row (non-numeric first cell) is skipped. Invalid rows are collected as
 * human-readable errors rather than throwing.
 */
export function parseHoldingsCsv(csv: string): ParseHoldingsResult {
  const rows: ParsedHoldingRow[] = [];
  const errors: string[] = [];

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const [i, line] of lines.entries()) {
    const cols = line.split(",").map((c) => c.trim());
    const schemeCode = Number(cols[0]);

    // Skip an obvious header row.
    if (i === 0 && !Number.isFinite(schemeCode)) continue;

    const units = Number(cols[1]);
    const avgCostNav = Number(cols[2]);

    if (!Number.isFinite(schemeCode) || schemeCode <= 0) {
      errors.push(`Row ${i + 1}: invalid AMFI code "${cols[0] ?? ""}".`);
      continue;
    }
    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(avgCostNav) || avgCostNav <= 0) {
      errors.push(`Row ${i + 1}: invalid units / avg cost.`);
      continue;
    }

    rows.push({ schemeCode, units, avgCostNav });
  }

  return { rows, errors };
}

/** Wrap a CSV cell, escaping quotes/commas/newlines per RFC 4180. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(",");
}
