import { fetchScheme } from "@/lib/data/mfapi";

/** The fields a holding needs to be valued at the latest NAV. */
export interface HeldFund {
  id: string;
  units: number;
  avgCostNav: number;
  investedAmount: number | null;
  amfiCode: string | null;
}

export interface ValuedHolding {
  id: string;
  invested: number;
  latestNav: number | null;
  navDate: string | null;
  /** Mark-to-market value when a NAV is available, else falls back to cost. */
  currentValue: number;
  /** True when `currentValue` is a real latest-NAV valuation (not a cost fallback). */
  valued: boolean;
  gain: number;
  gainPct: number | null;
}

/** Value a single holding at its fund's latest NAV (falls back to cost if unavailable). */
export async function valueHolding(h: HeldFund): Promise<ValuedHolding> {
  const invested = h.investedAmount ?? h.units * h.avgCostNav;

  let latestNav: number | null = null;
  let navDate: string | null = null;
  if (h.amfiCode) {
    try {
      const scheme = await fetchScheme(Number(h.amfiCode));
      const last = scheme.navHistory.at(-1);
      if (last) {
        latestNav = last.nav;
        navDate = last.date;
      }
    } catch {
      // Source unavailable — leave NAV null and fall back to cost basis below.
    }
  }

  const valued = latestNav != null;
  const currentValue = valued ? h.units * latestNav! : invested;
  const gain = currentValue - invested;
  const gainPct = invested > 0 ? gain / invested : null;

  return { id: h.id, invested, latestNav, navDate, currentValue, valued, gain, gainPct };
}

/** Value many holdings in parallel, keyed by holding id. */
export async function valueHoldings(holdings: HeldFund[]): Promise<Map<string, ValuedHolding>> {
  const results = await Promise.all(holdings.map(valueHolding));
  return new Map(results.map((r) => [r.id, r]));
}
