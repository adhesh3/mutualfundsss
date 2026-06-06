import { describe, expect, it } from "vitest";
import { SCORING_WEIGHTS, VERDICT_THRESHOLDS } from "@/lib/config";
import type { FundProfile } from "@/lib/data/types";
import type { NavPoint } from "@/lib/data/types";
import type { FundMetrics, RollingStats } from "./metrics";
import { recommend, recommendNfo, type InvestorView } from "./recommend";

const investor: InvestorView = { riskTolerance: "moderate", horizonYears: 7 };

function makeProfile(over: {
  identity?: Partial<FundProfile["identity"]>;
  navHistory?: NavPoint[];
  ratios?: FundProfile["ratios"];
  rules?: FundProfile["rules"];
  warnings?: string[];
} = {}): FundProfile {
  return {
    identity: { name: "Test Fund", category: "flexicap", assetClass: "equity", ...(over.identity ?? {}) },
    navHistory: over.navHistory ?? [],
    ratios: over.ratios ?? {},
    rules: over.rules ?? {},
    provenance: [],
    warnings: over.warnings ?? [],
    fetchedAt: "2024-01-01T00:00:00.000Z",
  };
}

function makeMetrics(over: Partial<FundMetrics> = {}): FundMetrics {
  return { yearsOfData: 6, trailing: {}, ...over };
}

const rolling = (pctAboveRf: number): RollingStats => ({
  windowYears: 3,
  count: 30,
  avg: 0.14,
  min: 0,
  max: 0.3,
  pctPositive: 1,
  pctAboveRf,
});

describe("recommend - verdict", () => {
  it("rates a strong fund Buy or better", () => {
    const profile = makeProfile({
      ratios: { expenseRatio: 0.3, aumCr: 5000, morningstar: 5 },
    });
    const metrics = makeMetrics({
      sharpe: 2.5,
      maxDrawdown: 0.12,
      rolling3y: rolling(1),
      trailing: { y1: 0.22, y3Cagr: 0.15 },
    });
    const rec = recommend(profile, metrics, investor);
    expect(rec.score).toBeGreaterThanOrEqual(VERDICT_THRESHOLDS.buy);
    expect(["Buy", "Strong Buy"]).toContain(rec.verdict);
  });

  it("rates a weak fund Avoid", () => {
    const profile = makeProfile({
      ratios: { expenseRatio: 2.2, aumCr: 40, morningstar: 1 },
    });
    const metrics = makeMetrics({
      sharpe: -0.5,
      maxDrawdown: 0.6,
      rolling3y: rolling(0),
      trailing: { y1: -0.1, y3Cagr: -0.02 },
    });
    const rec = recommend(profile, metrics, investor);
    expect(rec.score).toBeLessThan(VERDICT_THRESHOLDS.hold);
    expect(rec.verdict).toBe("Avoid");
  });
});

describe("recommend - debt reweighting", () => {
  it("weights cost higher for debt funds than equity", () => {
    const equity = recommend(makeProfile(), makeMetrics(), investor);
    const debt = recommend(
      makeProfile({ identity: { assetClass: "debt", category: "corporate" } }),
      makeMetrics(),
      investor,
    );
    const cost = (r: typeof equity) => r.pillars.find((p) => p.key === "cost")!.weight;
    expect(cost(equity)).toBeCloseTo(SCORING_WEIGHTS.cost, 5);
    expect(cost(debt)).toBeCloseTo(0.3, 5);
    expect(cost(debt)).toBeGreaterThan(cost(equity));
  });
});

describe("recommend - mode advice", () => {
  it("prefers lumpsum for debt funds", () => {
    const rec = recommend(
      makeProfile({ identity: { assetClass: "debt", category: "short_duration" } }),
      makeMetrics(),
      investor,
    );
    expect(rec.mode.recommendation).toBe("Lumpsum");
  });

  it("suggests STP-then-hold when down hard from peak and STP is available", () => {
    const navHistory: NavPoint[] = [
      { date: "2024-01-01", nav: 100 },
      { date: "2024-06-01", nav: 80 }, // 20% off peak
    ];
    const rec = recommend(
      makeProfile({ navHistory, rules: { stpAvailable: true } }),
      makeMetrics(),
      investor,
    );
    expect(rec.mode.recommendation).toBe("STP then hold");
  });

  it("falls back to lumpsum on a dip when STP is unavailable", () => {
    const navHistory: NavPoint[] = [
      { date: "2024-01-01", nav: 100 },
      { date: "2024-06-01", nav: 80 },
    ];
    const rec = recommend(makeProfile({ navHistory }), makeMetrics(), investor);
    expect(rec.mode.recommendation).toBe("Lumpsum");
  });

  it("recommends a SIP for high volatility near the highs", () => {
    const navHistory: NavPoint[] = [
      { date: "2024-01-01", nav: 90 },
      { date: "2024-06-01", nav: 100 }, // at peak -> no drawdown
    ];
    const rec = recommend(
      makeProfile({ navHistory }),
      makeMetrics({ annualizedVolatility: 0.25 }),
      investor,
    );
    expect(rec.mode.recommendation).toBe("SIP");
  });

  it("is flexible for moderate volatility with no dislocation", () => {
    const navHistory: NavPoint[] = [
      { date: "2024-01-01", nav: 90 },
      { date: "2024-06-01", nav: 100 },
    ];
    const rec = recommend(
      makeProfile({ navHistory }),
      makeMetrics({ annualizedVolatility: 0.1 }),
      investor,
    );
    expect(rec.mode.recommendation).toBe("SIP or Lumpsum");
  });
});

describe("recommend - horizon advice", () => {
  it("uses category min/ideal", () => {
    const rec = recommend(makeProfile({ identity: { category: "smallcap" } }), makeMetrics(), investor);
    expect(rec.horizon.minYears).toBe(7);
    expect(rec.horizon.idealYears).toBe(10);
  });

  it("respects a statutory lock-in", () => {
    const rec = recommend(
      makeProfile({ identity: { category: "elss" }, rules: { lockInDays: 365 * 3 } }),
      makeMetrics(),
      investor,
    );
    expect(rec.horizon.rationale).toMatch(/lock-in/i);
  });
});

describe("recommend - suitability", () => {
  it("flags aggressive categories for conservative investors", () => {
    const rec = recommend(
      makeProfile({ identity: { category: "smallcap" } }),
      makeMetrics(),
      { riskTolerance: "conservative", horizonYears: 10 },
    );
    expect(rec.suitability.fits).toBe(false);
  });

  it("flags an equity fund against too-short a horizon", () => {
    const rec = recommend(makeProfile({ identity: { category: "flexicap" } }), makeMetrics(), {
      riskTolerance: "moderate",
      horizonYears: 3,
    });
    expect(rec.suitability.fits).toBe(false);
  });

  it("accepts a well-matched fund", () => {
    const rec = recommend(makeProfile({ identity: { category: "flexicap" } }), makeMetrics(), investor);
    expect(rec.suitability.fits).toBe(true);
  });
});

describe("recommendNfo", () => {
  it("marks the result as an NFO with no track record", () => {
    const profile = makeProfile({ identity: { category: "flexicap", fundManager: "Jane Doe" }, ratios: { expenseRatio: 1.0 } });
    const rec = recommendNfo(profile, investor);
    expect(rec.isNfo).toBe(true);
    const track = rec.pillars.find((p) => p.key === "track_record")!;
    expect(track.score).toBe(0);
    expect(rec.notes[0]).toMatch(/NFOs rarely need/i);
    expect(["Hold", "Avoid"]).toContain(rec.verdict);
  });
});
