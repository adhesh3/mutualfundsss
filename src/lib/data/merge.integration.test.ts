import { describe, expect, it } from "vitest";
import { buildFundProfile } from "./merge";

const runIntegration = !!process.env.RUN_INTEGRATION;
const PPFAS = 122639;

describe.skipIf(!runIntegration)("merge.buildFundProfile (live)", () => {
  it("assembles a unified profile from all sources", async () => {
    const p = await buildFundProfile(PPFAS);

    expect(p.identity.name).toMatch(/parag parikh/i);
    expect(p.identity.category).toBe("flexicap");
    expect(p.identity.assetClass).toBe("equity");
    expect(p.navHistory.length).toBeGreaterThan(100);

    // mfapi is the backbone, so its identity + NAV provenance must be present.
    expect(p.provenance.some((x) => x.group === "navHistory" && x.source === "mfapi")).toBe(true);
    expect(Array.isArray(p.warnings)).toBe(true);
  }, 45_000);
});
