import { assetClassFor, classifyCategory } from "./categorize";
import { fetchKuvera } from "./kuvera";
import * as mfapi from "./mfapi";
import * as mfdata from "./mfdata";
import type { FundProfile, FundRatios, Provenance } from "./types";

export { searchSchemes } from "./mfapi";

const firstDefined = <T>(...vals: (T | undefined)[]): T | undefined =>
  vals.find((v) => v !== undefined && v !== null);

/**
 * Assemble a normalized FundProfile from all three APIs, keyed by AMFI/mfapi
 * scheme code. Each source is best-effort; failures become warnings rather
 * than hard errors so a partial profile is still useful.
 */
export async function buildFundProfile(schemeCode: number): Promise<FundProfile> {
  const warnings: string[] = [];
  const provenance: Provenance[] = [];

  // 1. mfapi: identity + NAV history + ISIN (the resolver/backbone).
  const mf = await mfapi.fetchScheme(schemeCode).catch((e: Error) => {
    warnings.push(`mfapi.in unavailable: ${e.message}`);
    return null;
  });

  const category = classifyCategory(mf?.schemeCategoryRaw);
  const assetClass = assetClassFor(category, mf?.schemeCategoryRaw);
  const isin = mf?.isin;

  if (mf) {
    provenance.push({ group: "identity", source: "mfapi" });
    provenance.push({
      group: "navHistory",
      source: "mfapi",
      asOf: mf.navHistory.at(-1)?.date,
    });
  }
  if (!mf?.navHistory.length) warnings.push("No NAV history available - computed metrics will be limited.");

  if (mf && /idcw|dividend|payout/i.test(mf.name)) {
    warnings.push(
      "This looks like an IDCW/dividend plan. Its NAV drops on each payout, so computed returns and risk metrics understate the true total return - analyze the Growth plan instead.",
    );
  }

  // 2. kuvera (by ISIN) + 3. mfdata (by AMFI code) in parallel.
  const [kuvera, mfd] = await Promise.all([
    isin
      ? fetchKuvera(isin).catch((e: Error) => {
          warnings.push(`Kuvera unavailable: ${e.message}`);
          return null;
        })
      : Promise.resolve(null),
    mfdata.fetchScheme(schemeCode).catch((e: Error) => {
      warnings.push(`mfdata.in unavailable: ${e.message}`);
      return null;
    }),
  ]);

  if (!isin) warnings.push("No ISIN resolved - Kuvera ratings/SIP rules unavailable.");
  if (kuvera) provenance.push({ group: "rules", source: "kuvera" });
  if (kuvera?.returns) provenance.push({ group: "apiReturns", source: "kuvera" });

  // Holdings from mfdata (needs the family id).
  let holdings;
  let sectors;
  if (mfd?.familyId) {
    const h = await mfdata.fetchHoldings(mfd.familyId).catch((e: Error) => {
      warnings.push(`mfdata.in holdings unavailable: ${e.message}`);
      return null;
    });
    if (h && h.holdings.length) {
      holdings = h.holdings;
      sectors = h.sectors.length ? h.sectors : undefined;
      provenance.push({ group: "holdings", source: "mfdata" });
    }
  }

  // Merge ratios: prefer mfdata for risk ratios, kuvera for cost/AUM/rating.
  const ratios: FundRatios = {
    expenseRatio: firstDefined(kuvera?.ratios.expenseRatio, mfd?.expenseRatio),
    aumCr: firstDefined(kuvera?.ratios.aumCr, mfd?.aumCr),
    sharpe: mfd?.ratios.sharpe,
    beta: mfd?.ratios.beta,
    alpha: mfd?.ratios.alpha,
    stdDev: mfd?.ratios.stdDev,
    pe: mfd?.ratios.pe,
    pb: mfd?.ratios.pb,
    volatility: kuvera?.ratios.volatility,
    crisilRating: kuvera?.ratios.crisilRating,
    morningstar: mfd?.morningstar,
    fundRating: kuvera?.ratios.fundRating,
  };
  if (mfd || kuvera) provenance.push({ group: "ratios", source: mfd ? "mfdata" : "kuvera" });

  return {
    identity: {
      schemeCode,
      isin,
      name: mf?.name ?? kuvera?.name ?? `Scheme ${schemeCode}`,
      amc: firstDefined(mf?.amc, kuvera?.amc),
      schemeType: mf?.schemeType,
      schemeCategoryRaw: firstDefined(mf?.schemeCategoryRaw, kuvera?.category),
      category,
      assetClass,
      fundManager: kuvera?.fundManager,
      benchmark: undefined,
    },
    navHistory: mf?.navHistory ?? [],
    apiReturns: kuvera?.returns,
    ratios,
    rules: kuvera?.rules ?? {},
    holdings,
    sectors,
    provenance,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}
