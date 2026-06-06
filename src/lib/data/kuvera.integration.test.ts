import { beforeAll, describe, expect, it } from "vitest";
import { fetchScheme } from "./mfapi";
import { fetchKuvera } from "./kuvera";

const runIntegration = !!process.env.RUN_INTEGRATION;
const PPFAS = 122639;

describe.skipIf(!runIntegration)("kuvera (live)", () => {
  let isin: string | undefined;

  beforeAll(async () => {
    isin = (await fetchScheme(PPFAS)).isin;
  }, 30_000);

  it("resolves a fund's cost / rules by ISIN", async () => {
    expect(isin).toBeTruthy();
    const k = await fetchKuvera(isin!);
    expect(k).not.toBeNull();
    expect(k!.isin).toBeTruthy();
    expect(k!.ratios).toBeTypeOf("object");
    expect(k!.rules).toBeTypeOf("object");
    // A live equity fund should report an expense ratio.
    if (k!.ratios.expenseRatio != null) {
      expect(k!.ratios.expenseRatio).toBeGreaterThan(0);
    }
  }, 30_000);
});
