import { describe, expect, it } from "vitest";
import { searchSchemes, fetchScheme, fetchNavSeries } from "./mfapi";

// Live tests hit the real mfapi.in API. They only run when RUN_INTEGRATION is
// set (see `npm run test:integration`) so the default suite / CI stay offline.
const runIntegration = !!process.env.RUN_INTEGRATION;

// Parag Parikh Flexi Cap Fund - Direct Plan - Growth (a stable, long-running fund).
const PPFAS = 122639;

describe.skipIf(!runIntegration)("mfapi (live)", () => {
  it("searches schemes by name", async () => {
    const res = await searchSchemes("parag parikh flexi");
    expect(res.length).toBeGreaterThan(0);
    expect(res.some((r) => /parag parikh/i.test(r.schemeName))).toBe(true);
    expect(typeof res[0].schemeCode).toBe("number");
  }, 30_000);

  it("fetches NAV history in ascending order with positive NAVs", async () => {
    const s = await fetchScheme(PPFAS);
    expect(s.name).toMatch(/parag parikh/i);
    expect(s.navHistory.length).toBeGreaterThan(100);

    const h = s.navHistory;
    expect(h[0].date <= h[h.length - 1].date).toBe(true);
    expect(h.every((p) => p.nav > 0)).toBe(true);
    expect(h[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO yyyy-mm-dd
  }, 30_000);

  it("fetchNavSeries returns the same series", async () => {
    const series = await fetchNavSeries(PPFAS);
    expect(series.length).toBeGreaterThan(100);
  }, 30_000);
});
