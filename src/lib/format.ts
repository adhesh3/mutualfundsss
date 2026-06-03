/** Display helpers. All amounts are plain rupees (numbers), formatted at render time. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatINR(value: number | null | undefined, precise = false): string {
  if (value == null || Number.isNaN(value)) return "--";
  return (precise ? inrPrecise : inr).format(value);
}

/** Indian abbreviated currency: 1.2 Cr, 45.0 L, etc. Useful for AUM. */
export function formatINRCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return value.toFixed(0);
}

/** value is a fraction (0.123 -> "12.3%"). Pass already-percent values with isRatio=false. */
export function formatPct(
  value: number | null | undefined,
  { isRatio = true, digits = 1, withSign = false }: { isRatio?: boolean; digits?: number; withSign?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return "--";
  const pct = isRatio ? value * 100 : value;
  const sign = withSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "--";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
