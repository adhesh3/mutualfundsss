/**
 * Central tunables for the analyzer. Override RISK_FREE_RATE via env if desired;
 * everything else is intentionally code-config so the rule engine stays transparent.
 */

export const RISK_FREE_RATE = Number(process.env.RISK_FREE_RATE ?? 0.066); // ~6.6% (India)

export const TRADING_DAYS_PER_YEAR = 252;

/** Cache time-to-live per source (ms). NAV refreshes a few times a day. */
export const CACHE_TTL_MS = {
  kuvera: 12 * 60 * 60 * 1000,
  mfdata: 12 * 60 * 60 * 1000,
  mfapi: 6 * 60 * 60 * 1000,
} as const;

export type AssetClass = "equity" | "debt" | "hybrid" | "gold" | "other";

export type FundCategory =
  | "largecap"
  | "midcap"
  | "smallcap"
  | "flexicap"
  | "elss"
  | "hybrid"
  | "index"
  | "liquid"
  | "short_duration"
  | "corporate"
  | "gilt"
  | "other";

export const RISK_TOLERANCES = ["conservative", "moderate", "aggressive"] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

/** Minimum sensible holding horizon (years) by category - feeds the horizon recommendation. */
export const HORIZON_BY_CATEGORY: Record<FundCategory, { min: number; ideal: number }> = {
  smallcap: { min: 7, ideal: 10 },
  midcap: { min: 5, ideal: 7 },
  flexicap: { min: 5, ideal: 7 },
  elss: { min: 3, ideal: 5 }, // 3y statutory lock-in
  largecap: { min: 5, ideal: 7 },
  index: { min: 5, ideal: 7 },
  hybrid: { min: 3, ideal: 5 },
  corporate: { min: 2, ideal: 3 },
  gilt: { min: 2, ideal: 4 },
  short_duration: { min: 1, ideal: 3 },
  liquid: { min: 0.1, ideal: 1 },
  other: { min: 3, ideal: 5 },
};

export const ASSET_CLASS_BY_CATEGORY: Record<FundCategory, AssetClass> = {
  largecap: "equity",
  midcap: "equity",
  smallcap: "equity",
  flexicap: "equity",
  elss: "equity",
  index: "equity",
  hybrid: "hybrid",
  liquid: "debt",
  short_duration: "debt",
  corporate: "debt",
  gilt: "debt",
  other: "other",
};

/** Benchmark NAV proxy (mfapi scheme codes for index funds) used for beta/alpha. */
export const BENCHMARK_SCHEME_BY_ASSET: Record<AssetClass, number | null> = {
  equity: 120716, // UTI Nifty 50 Index Fund - Direct - Growth (proxy for Nifty TRI)
  hybrid: 120716,
  debt: null, // debt funds compared to risk-free, not an equity index
  gold: null,
  other: null,
};

/** Rule-engine pillar weights (must sum to 1). Equity-leaning; debt funds reweight at runtime. */
export const SCORING_WEIGHTS = {
  riskAdjusted: 0.25, // Sharpe / Sortino
  consistency: 0.2, // rolling-return hit rate
  downside: 0.2, // max drawdown / downside capture
  cost: 0.15, // expense ratio
  pedigree: 0.1, // AUM + rating
  momentum: 0.1, // recent vs long-term
} as const;

export const VERDICT_THRESHOLDS = {
  strongBuy: 78,
  buy: 62,
  hold: 45,
} as const; // below `hold` => Avoid

/** Drawdown (fraction off peak) at which a non-weak watched fund is flagged as "on sale". */
export const BUY_SIGNAL_DRAWDOWN = {
  watch: 0.1, // 10% below peak -> worth a look
  strong: 0.2, // 20%+ below peak -> notable dislocation
} as const;

/** Allocation drift (percentage points vs target) that triggers a rebalance alert. */
export const REBALANCE_DRIFT_PTS = 7;

/** Fixed-income instruments maturing within this many days surface as reminders. */
export const MATURITY_HORIZON_DAYS = 90;

export const DISCLAIMER =
  "For personal research only. Not investment advice. Data comes from free, unofficial APIs and may be delayed or inaccurate. Mutual fund investments are subject to market risks.";
