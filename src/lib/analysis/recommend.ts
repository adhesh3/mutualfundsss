import {
  HORIZON_BY_CATEGORY,
  SCORING_WEIGHTS,
  VERDICT_THRESHOLDS,
  type AssetClass,
  type RiskTolerance,
} from "@/lib/config";
import type { FundProfile } from "@/lib/data/types";
import { maxDrawdown } from "./metrics";
import type { FundMetrics } from "./metrics";

export type Verdict = "Strong Buy" | "Buy" | "Hold" | "Avoid";
export type InvestMode = "SIP" | "Lumpsum" | "STP then hold" | "SIP or Lumpsum";

export interface PillarScore {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  reason: string;
}

export interface ModeAdvice {
  recommendation: InvestMode;
  rationale: string;
  sipMin?: number;
  lumpMin?: number;
}

export interface HorizonAdvice {
  minYears: number;
  idealYears: number;
  rationale: string;
}

export interface SuitabilityAdvice {
  fits: boolean;
  note: string;
}

export interface Recommendation {
  isNfo: boolean;
  score: number;
  verdict: Verdict;
  pillars: PillarScore[];
  mode: ModeAdvice;
  horizon: HorizonAdvice;
  suitability: SuitabilityAdvice;
  notes: string[];
}

export interface InvestorView {
  riskTolerance: RiskTolerance;
  horizonYears: number;
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Map a value through linear breakpoints [input, score] (ascending input). */
function scoreFromBreakpoints(value: number | undefined, points: [number, number][]): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (value <= points[0][0]) return points[0][1];
  if (value >= points.at(-1)![0]) return points.at(-1)![1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
  }
  return undefined;
}

/** Equity drawdowns are expected to be larger; scale the "downside" pillar by asset class. */
function drawdownScore(maxDd: number | undefined, assetClass: AssetClass): number | undefined {
  if (maxDd == null) return undefined;
  const dd = maxDd * 100;
  if (assetClass === "debt") {
    return scoreFromBreakpoints(dd, [
      [0, 100],
      [2, 80],
      [5, 55],
      [10, 25],
      [20, 0],
    ]);
  }
  // equity / hybrid / other
  return scoreFromBreakpoints(dd, [
    [10, 100],
    [25, 80],
    [40, 55],
    [55, 30],
    [70, 0],
  ]);
}

function ratingScore(profile: FundProfile): number | undefined {
  const stars = profile.ratios.morningstar ?? profile.ratios.fundRating;
  if (stars != null) return clamp((stars / 5) * 100);
  return undefined;
}

function pillarWeightsFor(assetClass: AssetClass) {
  // Debt funds: cost and downside matter more, return-consistency less.
  if (assetClass === "debt") {
    return {
      riskAdjusted: 0.2,
      consistency: 0.1,
      downside: 0.25,
      cost: 0.3,
      pedigree: 0.1,
      momentum: 0.05,
    };
  }
  return { ...SCORING_WEIGHTS };
}

function verdictFromScore(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.strongBuy) return "Strong Buy";
  if (score >= VERDICT_THRESHOLDS.buy) return "Buy";
  if (score >= VERDICT_THRESHOLDS.hold) return "Hold";
  return "Avoid";
}

function currentDrawdown(profile: FundProfile): number {
  if (profile.navHistory.length < 2) return 0;
  const peak = Math.max(...profile.navHistory.map((p) => p.nav));
  const last = profile.navHistory.at(-1)!.nav;
  return peak > 0 ? (peak - last) / peak : 0;
}

function buildPillars(profile: FundProfile, metrics: FundMetrics): PillarScore[] {
  const assetClass = profile.identity.assetClass ?? "equity";

  // Risk-adjusted: prefer computed Sharpe, fall back to API Sharpe.
  const sharpe = Number.isFinite(metrics.sharpe ?? NaN) ? metrics.sharpe : profile.ratios.sharpe;
  const sharpeScore = scoreFromBreakpoints(sharpe, [
    [-0.5, 0],
    [0, 25],
    [0.5, 50],
    [1.0, 72],
    [1.5, 90],
    [2.5, 100],
  ]);

  // Consistency: share of rolling 3y windows that beat the risk-free rate.
  const rolling = metrics.rolling3y ?? metrics.rolling5y ?? null;
  const consistencyScore = rolling
    ? clamp(rolling.pctAboveRf * 100)
    : metrics.trailing.y3Cagr != null
      ? 55
      : undefined;

  const ddScore = drawdownScore(metrics.maxDrawdown ?? maxDrawdown(profile.navHistory), assetClass);

  const costScore =
    assetClass === "debt"
      ? scoreFromBreakpoints(profile.ratios.expenseRatio, [
          [0.1, 100],
          [0.3, 85],
          [0.6, 60],
          [1.0, 30],
          [1.5, 0],
        ])
      : scoreFromBreakpoints(profile.ratios.expenseRatio, [
          [0.2, 100],
          [0.5, 88],
          [1.0, 65],
          [1.5, 40],
          [2.2, 0],
        ]);

  // Pedigree: blend AUM adequacy with star rating.
  const aum = profile.ratios.aumCr;
  const aumScore =
    aum == null
      ? undefined
      : scoreFromBreakpoints(aum, [
          [50, 35], // very small -> liquidity/viability risk
          [300, 70],
          [1000, 90],
          [5000, 100],
          [50000, 90], // very large -> harder to be nimble (esp. small/mid)
        ]);
  const rating = ratingScore(profile);
  const pedigreeScore =
    aumScore != null && rating != null
      ? (aumScore + rating) / 2
      : (aumScore ?? rating);

  // Momentum: recent (6-12m) vs long-term (3y) trend.
  const recent = metrics.trailing.y1 ?? metrics.trailing.m6;
  const longTerm = metrics.trailing.y3Cagr ?? metrics.trailing.sinceInceptionCagr;
  let momentumScore: number | undefined;
  if (recent != null && longTerm != null) {
    const spread = recent - longTerm; // positive => accelerating
    momentumScore = clamp(60 + spread * 200);
  } else if (recent != null) {
    momentumScore = clamp(50 + recent * 150);
  }

  const weights = pillarWeightsFor(assetClass);

  const raw: Omit<PillarScore, "weight">[] = [
    {
      key: "riskAdjusted",
      label: "Risk-adjusted return",
      score: sharpeScore ?? 50,
      reason:
        sharpe != null
          ? `Sharpe ${sharpe.toFixed(2)} - ${sharpe >= 1 ? "strong" : sharpe >= 0.5 ? "fair" : "weak"} reward per unit of risk.`
          : "No Sharpe available; treated as neutral.",
    },
    {
      key: "consistency",
      label: "Return consistency",
      score: consistencyScore ?? 50,
      reason: rolling
        ? `${(rolling.pctAboveRf * 100).toFixed(0)}% of rolling ${rolling.windowYears}y windows beat the risk-free rate (avg ${(rolling.avg * 100).toFixed(1)}%).`
        : "Not enough history for rolling-return analysis.",
    },
    {
      key: "downside",
      label: "Downside protection",
      score: ddScore ?? 50,
      reason:
        metrics.maxDrawdown != null
          ? `Worst drawdown ${(metrics.maxDrawdown * 100).toFixed(0)}% - ${metrics.maxDrawdown < 0.25 ? "contained" : "deep"} for a ${assetClass} fund.`
          : "Drawdown unavailable.",
    },
    {
      key: "cost",
      label: "Cost (expense ratio)",
      score: costScore ?? 50,
      reason:
        profile.ratios.expenseRatio != null
          ? `TER ${profile.ratios.expenseRatio}% - ${profile.ratios.expenseRatio < 1 ? "lean" : "on the higher side"}.`
          : "Expense ratio unknown.",
    },
    {
      key: "pedigree",
      label: "Size & rating",
      score: pedigreeScore ?? 50,
      reason: [
        aum != null ? `AUM Rs ${aum.toLocaleString("en-IN")} Cr` : null,
        profile.ratios.crisilRating ? `CRISIL ${profile.ratios.crisilRating}` : null,
        rating != null ? `${((profile.ratios.morningstar ?? profile.ratios.fundRating) ?? 0)}/5 stars` : null,
      ]
        .filter(Boolean)
        .join(" | ") || "Limited size/rating data.",
    },
    {
      key: "momentum",
      label: "Momentum",
      score: momentumScore ?? 50,
      reason:
        recent != null && longTerm != null
          ? `1y ${(recent * 100).toFixed(1)}% vs 3y ${(longTerm * 100).toFixed(1)}% - ${recent >= longTerm ? "accelerating" : "cooling"}.`
          : "Insufficient data for momentum.",
    },
  ];

  return raw.map((p) => ({ ...p, weight: weights[p.key as keyof typeof weights] ?? 0 }));
}

function adviseMode(profile: FundProfile, metrics: FundMetrics): ModeAdvice {
  const assetClass = profile.identity.assetClass ?? "equity";
  const vol = metrics.annualizedVolatility ?? (profile.ratios.volatility ? profile.ratios.volatility / 100 : undefined);
  const dd = currentDrawdown(profile);
  const sipMin = profile.rules.sipMin;
  const lumpMin = profile.rules.lumpMin;

  if (assetClass === "debt") {
    return {
      recommendation: "Lumpsum",
      rationale:
        "Debt/low-volatility fund - returns are relatively smooth, so staggering entry adds little. Lumpsum is fine; match the fund's duration to when you need the money.",
      sipMin,
      lumpMin,
    };
  }

  if (dd > 0.12) {
    return {
      recommendation: profile.rules.stpAvailable ? "STP then hold" : "Lumpsum",
      rationale: `The fund is ~${(dd * 100).toFixed(0)}% below its peak. Valuations are off their highs, so deploying a lumpsum now (or an STP over 2-3 months from a liquid fund) is attractive.`,
      sipMin,
      lumpMin,
    };
  }

  if ((vol ?? 0.18) > 0.16) {
    return {
      recommendation: "SIP",
      rationale: `High volatility (${vol ? (vol * 100).toFixed(0) : ">16"}% annualized) near the highs - a SIP averages your cost and removes timing risk. Step up on sharp dips.`,
      sipMin,
      lumpMin,
    };
  }

  return {
    recommendation: "SIP or Lumpsum",
    rationale:
      "Moderate volatility and no obvious dislocation. A SIP is the low-stress default; a lumpsum is reasonable if this money is already idle and your horizon is long.",
    sipMin,
    lumpMin,
  };
}

function adviseHorizon(profile: FundProfile): HorizonAdvice {
  const cat = profile.identity.category ?? "other";
  const { min, ideal } = HORIZON_BY_CATEGORY[cat];
  const lockYears = profile.rules.lockInDays ? profile.rules.lockInDays / 365 : 0;
  const minYears = Math.max(min, lockYears);
  return {
    minYears,
    idealYears: ideal,
    rationale:
      lockYears >= 1
        ? `${cat} category suggests ${ideal}+ years; note a ~${lockYears.toFixed(0)}y lock-in.`
        : `${cat} funds are best held ${min}-${ideal}+ years to ride out cycles.`,
  };
}

function adviseSuitability(profile: FundProfile, investor: InvestorView): SuitabilityAdvice {
  const assetClass = profile.identity.assetClass ?? "equity";
  const cat = profile.identity.category ?? "other";
  const aggressiveCats = cat === "smallcap" || cat === "midcap";

  if (investor.riskTolerance === "conservative" && aggressiveCats) {
    return {
      fits: false,
      note: `${cat} funds can swing hard - heavy for a conservative profile. Cap exposure and pair with debt.`,
    };
  }
  const horizon = HORIZON_BY_CATEGORY[cat];
  if (assetClass === "equity" && investor.horizonYears < horizon.min) {
    return {
      fits: false,
      note: `Your ${investor.horizonYears}y horizon is shorter than the ${horizon.min}y minimum for ${cat} funds - consider a shorter-duration option.`,
    };
  }
  return { fits: true, note: "Aligns with your stated risk and horizon." };
}

export function recommend(
  profile: FundProfile,
  metrics: FundMetrics,
  investor: InvestorView,
): Recommendation {
  const pillars = buildPillars(profile, metrics);
  const totalWeight = pillars.reduce((a, p) => a + p.weight, 0) || 1;
  const score = clamp(pillars.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight);

  return {
    isNfo: false,
    score,
    verdict: verdictFromScore(score),
    pillars,
    mode: adviseMode(profile, metrics),
    horizon: adviseHorizon(profile),
    suitability: adviseSuitability(profile, investor),
    notes: profile.warnings,
  };
}

/**
 * NFOs have no track record, so we cannot score risk/return. Produce a
 * qualitative scorecard from what is knowable, and bias toward caution.
 */
export function recommendNfo(profile: FundProfile, investor: InvestorView): Recommendation {
  const cat = profile.identity.category ?? "other";
  const horizon = adviseHorizon(profile);
  const suitability = adviseSuitability(profile, investor);

  const pillars: PillarScore[] = [
    {
      key: "track_record",
      label: "Track record",
      score: 0,
      weight: 0.4,
      reason: "New fund offer - no NAV history to evaluate returns, risk, or consistency.",
    },
    {
      key: "cost",
      label: "Cost (expense ratio)",
      score:
        profile.ratios.expenseRatio != null
          ? clamp(100 - profile.ratios.expenseRatio * 45)
          : 45,
      weight: 0.3,
      reason:
        profile.ratios.expenseRatio != null
          ? `Stated TER ${profile.ratios.expenseRatio}%.`
          : "Expense ratio not disclosed yet - assume on the higher side for a new fund.",
    },
    {
      key: "mandate",
      label: "Mandate clarity",
      score: profile.identity.fundManager ? 60 : 45,
      weight: 0.3,
      reason: profile.identity.fundManager
        ? `Managed by ${profile.identity.fundManager}. Judge by the AMC's track record in similar ${cat} funds.`
        : "Evaluate the AMC's existing funds in this category as a proxy.",
    },
  ];
  const score = clamp(pillars.reduce((a, p) => a + p.score * p.weight, 0));

  return {
    isNfo: true,
    score,
    verdict: score >= 55 ? "Hold" : "Avoid",
    pillars,
    mode: {
      recommendation: "SIP",
      rationale:
        "If you invest at all, prefer a small SIP after launch rather than a lumpsum at NAV 10 - there is no performance to justify conviction yet.",
    },
    horizon,
    suitability,
    notes: [
      "NFOs rarely need to be bought at launch. Unless this fills a genuine gap (a new theme/strategy you can't already access), an existing fund with a multi-year record is usually the safer pick.",
      ...profile.warnings,
    ],
  };
}
