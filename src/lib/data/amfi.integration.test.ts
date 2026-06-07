import { describe, expect, it } from "vitest";
import { fetchCatalog } from "./amfi";

const runIntegration = !!process.env.RUN_INTEGRATION;

// Live test against the real AMFI NAVAll feed. Read-only (no DB writes), so it's
// safe to opt into via `npm run test:integration`.
describe.skipIf(!runIntegration)("amfi (live)", () => {
  it("fetches and parses the whole fund universe", async () => {
    const catalog = await fetchCatalog();
    expect(catalog.length).toBeGreaterThan(1000);

    // A well-known, long-running fund should be present and classified.
    const ppfas = catalog.find((e) => e.schemeCode === 122639);
    expect(ppfas).toBeTruthy();
    expect(ppfas!.category).toBe("flexicap");
    expect(ppfas!.plan).toBe("direct");
    expect((ppfas!.latestNav ?? 0)).toBeGreaterThan(0);

    // Every parsed row has the essentials.
    expect(catalog.every((e) => Number.isFinite(e.schemeCode) && e.name.length > 0)).toBe(true);
  }, 60_000);
});
