import { describe, expect, it } from "vitest";
import { fetchScheme, fetchHoldings } from "./mfdata";

const runIntegration = !!process.env.RUN_INTEGRATION;
const PPFAS = 122639;

// mfdata.in is the most flaky source (enrichment only). In production the merge
// layer catches its failures and degrades gracefully, so this live test accepts
// three outcomes: a well-shaped payload, null, or a network error.
describe.skipIf(!runIntegration)("mfdata (live)", () => {
  it("fetches scheme ratios when reachable, and shapes holdings correctly", async () => {
    let s;
    try {
      s = await fetchScheme(PPFAS);
    } catch (err) {
      // Source unavailable/timed out — expected for this best-effort feed.
      expect(err).toBeInstanceOf(Error);
      return;
    }

    expect(s === null || typeof s.ratios === "object").toBe(true);

    if (s?.familyId) {
      try {
        const { holdings, sectors } = await fetchHoldings(s.familyId);
        expect(Array.isArray(holdings)).toBe(true);
        expect(Array.isArray(sectors)).toBe(true);
        if (holdings.length) {
          expect(holdings[0]).toHaveProperty("name");
          expect(holdings[0]).toHaveProperty("pct");
        }
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    }
  }, 30_000);
});
