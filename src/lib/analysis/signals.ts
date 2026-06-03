import { BUY_SIGNAL_DRAWDOWN, MATURITY_HORIZON_DAYS } from "@/lib/config";
import type { NavPoint } from "@/lib/data/types";
import type { FundAnalysis } from "./analyze";
import type { Verdict } from "./recommend";

/** How far the latest NAV sits below its all-time peak, as a positive fraction. */
export function currentDrawdown(navHistory: NavPoint[]): number {
  if (navHistory.length < 2) return 0;
  const peak = Math.max(...navHistory.map((p) => p.nav));
  const last = navHistory.at(-1)!.nav;
  return peak > 0 ? (peak - last) / peak : 0;
}

export interface BuySignal {
  schemeCode: number;
  name: string;
  verdict: Verdict;
  score: number;
  drawdown: number;
  strength: "watch" | "strong";
  mode: string;
  message: string;
}

/**
 * Flag a watched fund that is meaningfully off its peak — but only if the rule
 * engine doesn't rate it "Avoid" (we don't suggest buying weak funds just
 * because they fell). A bigger drawdown on a quality fund is a stronger signal.
 */
export function buySignalFor(schemeCode: number, analysis: FundAnalysis): BuySignal | null {
  const drawdown = currentDrawdown(analysis.profile.navHistory);
  if (drawdown < BUY_SIGNAL_DRAWDOWN.watch) return null;

  const { verdict, score, mode } = analysis.recommendation;
  if (verdict === "Avoid") return null;

  const strength = drawdown >= BUY_SIGNAL_DRAWDOWN.strong ? "strong" : "watch";
  const ddPct = (drawdown * 100).toFixed(0);
  const message =
    strength === "strong"
      ? `Down ~${ddPct}% from its peak — a notable dislocation on a ${verdict} fund. ${mode.recommendation === "SIP" ? "Consider stepping up your SIP" : `Consider ${mode.recommendation.toLowerCase()}`}.`
      : `~${ddPct}% below its peak. Worth a look while it's off its highs.`;

  return { schemeCode, name: analysis.profile.identity.name, verdict, score, drawdown, strength, mode: mode.recommendation, message };
}

export interface MaturityReminder {
  id: string;
  name: string;
  principal: number;
  maturityDate: Date;
  daysToMaturity: number;
}

/** Fixed-income instruments maturing within `withinDays`, soonest first. */
export function maturityReminders<T extends { id: string; name: string; principal: number; maturityDate: Date | null }>(
  instruments: T[],
  withinDays: number = MATURITY_HORIZON_DAYS,
): MaturityReminder[] {
  const now = Date.now();
  const horizon = withinDays * 24 * 60 * 60 * 1000;
  return instruments
    .filter((i) => i.maturityDate && i.maturityDate.getTime() >= now && i.maturityDate.getTime() - now <= horizon)
    .map((i) => ({
      id: i.id,
      name: i.name,
      principal: i.principal,
      maturityDate: i.maturityDate!,
      daysToMaturity: Math.ceil((i.maturityDate!.getTime() - now) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => a.daysToMaturity - b.daysToMaturity);
}
