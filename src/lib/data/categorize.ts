import { ASSET_CLASS_BY_CATEGORY, type AssetClass, type FundCategory } from "@/lib/config";

/** Best-effort mapping of a free-text scheme category to our internal taxonomy. */
export function classifyCategory(raw?: string | null): FundCategory {
  if (!raw) return "other";
  const s = raw.toLowerCase();

  if (s.includes("elss") || s.includes("tax saving") || s.includes("tax saver")) return "elss";
  if (s.includes("small cap") || s.includes("smallcap")) return "smallcap";
  if (s.includes("mid cap") || s.includes("midcap")) return "midcap";
  if (s.includes("large cap") || s.includes("largecap") || s.includes("bluechip")) return "largecap";
  if (s.includes("flexi cap") || s.includes("multi cap") || s.includes("multicap") || s.includes("flexicap"))
    return "flexicap";
  if (s.includes("index") || s.includes("etf") || s.includes("nifty") || s.includes("sensex")) return "index";

  if (s.includes("liquid") || s.includes("overnight") || s.includes("money market")) return "liquid";
  if (s.includes("corporate bond") || s.includes("banking and psu") || s.includes("psu")) return "corporate";
  if (s.includes("gilt") || s.includes("g-sec") || s.includes("government securities")) return "gilt";
  if (
    s.includes("short duration") ||
    s.includes("low duration") ||
    s.includes("ultra short") ||
    s.includes("short term")
  )
    return "short_duration";

  if (s.includes("hybrid") || s.includes("balanced") || s.includes("asset allocation") || s.includes("aggressive hybrid"))
    return "hybrid";

  if (s.includes("debt") || s.includes("bond") || s.includes("income") || s.includes("duration")) return "short_duration";
  if (s.includes("equity")) return "flexicap";
  return "other";
}

export function assetClassFor(category: FundCategory, raw?: string | null): AssetClass {
  if (raw) {
    const s = raw.toLowerCase();
    if (s.includes("gold") || s.includes("silver") || s.includes("commodit")) return "gold";
  }
  return ASSET_CLASS_BY_CATEGORY[category];
}
