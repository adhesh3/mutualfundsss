import type { AssetClass, RiskTolerance } from "@/lib/config";

export interface TargetAllocation {
  equityPct: number;
  debtPct: number;
  goldPct: number;
  rationale: string;
}

export interface InvestorAllocationInput {
  riskTolerance: RiskTolerance;
  horizonYears: number;
  age?: number | null;
}

const clampPct = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/** Suggest a target equity/debt/gold split from risk, horizon, and (optionally) age. */
export function suggestTargetAllocation(input: InvestorAllocationInput): TargetAllocation {
  const base = { conservative: 35, moderate: 60, aggressive: 80 }[input.riskTolerance];
  let equity = base;

  if (input.horizonYears < 3) equity = Math.min(equity, 20);
  else if (input.horizonYears < 5) equity = Math.min(equity, 45);
  else if (input.horizonYears >= 10) equity += 10;

  // Blend with the classic "110 - age" heuristic when age is known.
  if (input.age && input.age > 0) {
    const ageEquity = 110 - input.age;
    equity = (equity + ageEquity) / 2;
  }

  equity = clampPct(equity);
  const gold = input.riskTolerance === "aggressive" ? 5 : 10;
  const debt = clampPct(100 - equity - gold);

  return {
    equityPct: equity,
    debtPct: debt,
    goldPct: gold,
    rationale: `A ${input.riskTolerance} profile over ${input.horizonYears} years suggests roughly ${equity}% equity / ${debt}% debt / ${gold}% gold. Debt cushions drawdowns and funds near-term needs; trim equity as the goal approaches.`,
  };
}

export interface AllocationPosition {
  assetClass: AssetClass;
  amount: number;
}

export interface AllocationDrift {
  total: number;
  current: { equity: number; debt: number; gold: number; other: number };
  target: { equity: number; debt: number; gold: number };
  nudges: string[];
}

export function computeAllocation(
  positions: AllocationPosition[],
  target: { equityPct: number; debtPct: number; goldPct: number },
): AllocationDrift {
  const total = positions.reduce((a, p) => a + p.amount, 0);
  const pctOf = (cls: AssetClass | "equityLike") => {
    if (total === 0) return 0;
    const sum = positions
      .filter((p) =>
        cls === "equityLike" ? p.assetClass === "equity" || p.assetClass === "hybrid" : p.assetClass === cls,
      )
      .reduce((a, p) => a + p.amount, 0);
    return (sum / total) * 100;
  };

  const current = {
    equity: pctOf("equityLike"),
    debt: pctOf("debt"),
    gold: pctOf("gold"),
    other: pctOf("other"),
  };

  const nudges: string[] = [];
  const check = (label: string, cur: number, tgt: number) => {
    const drift = cur - tgt;
    if (Math.abs(drift) >= 7) {
      nudges.push(
        drift > 0
          ? `${label} is ${drift.toFixed(0)} pts above target (${cur.toFixed(0)}% vs ${tgt}%) - consider trimming or redirecting new money elsewhere.`
          : `${label} is ${Math.abs(drift).toFixed(0)} pts below target (${cur.toFixed(0)}% vs ${tgt}%) - consider topping up.`,
      );
    }
  };
  if (total > 0) {
    check("Equity", current.equity, target.equityPct);
    check("Debt", current.debt, target.debtPct);
    check("Gold", current.gold, target.goldPct);
  }

  return {
    total,
    current,
    target: { equity: target.equityPct, debt: target.debtPct, gold: target.goldPct },
    nudges,
  };
}

/** Recommend debt sub-categories appropriate to a holding horizon. */
export function suggestedDebtCategories(horizonYears: number): { categories: string[]; note: string } {
  if (horizonYears < 1) {
    return {
      categories: ["Liquid", "Overnight"],
      note: "Under a year: capital safety first. Liquid/overnight funds or a sweep-in FD.",
    };
  }
  if (horizonYears < 3) {
    return {
      categories: ["Short Duration", "Money Market", "Corporate Bond"],
      note: "1-3 years: short-duration and high-quality corporate bond funds balance yield and stability.",
    };
  }
  if (horizonYears < 5) {
    return {
      categories: ["Corporate Bond", "Banking & PSU", "Short Duration"],
      note: "3-5 years: AAA corporate bond / banking & PSU funds. Avoid heavy credit risk.",
    };
  }
  return {
    categories: ["Gilt", "Corporate Bond", "Target Maturity"],
    note: "5+ years: gilt or target-maturity funds can lock in yields; pair with corporate bond funds.",
  };
}
