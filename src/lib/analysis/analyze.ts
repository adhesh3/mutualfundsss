import { BENCHMARK_SCHEME_BY_ASSET } from "@/lib/config";
import { buildFundProfile } from "@/lib/data/merge";
import { fetchNavSeries } from "@/lib/data/mfapi";
import type { FundProfile, NavPoint } from "@/lib/data/types";
import { computeMetrics, type FundMetrics, sipVsLumpsum, type SipVsLumpsum } from "./metrics";
import { recommend, type InvestorView, type Recommendation } from "./recommend";

export interface FundAnalysis {
  profile: FundProfile;
  metrics: FundMetrics;
  recommendation: Recommendation;
  sipVsLumpsum: SipVsLumpsum | null;
}

export async function analyzeFund(schemeCode: number, investor: InvestorView): Promise<FundAnalysis> {
  const profile = await buildFundProfile(schemeCode);

  const benchCode = profile.identity.assetClass
    ? BENCHMARK_SCHEME_BY_ASSET[profile.identity.assetClass]
    : null;

  let benchmark: NavPoint[] | undefined;
  if (benchCode && benchCode !== schemeCode && profile.navHistory.length > 30) {
    benchmark = (await fetchNavSeries(benchCode).catch(() => undefined)) ?? undefined;
  }

  const metrics = computeMetrics(profile.navHistory, benchmark);
  const recommendation = recommend(profile, metrics, investor);

  const window = Math.min(5, Math.max(1, Math.floor(metrics.yearsOfData)));
  const svl = profile.navHistory.length > 30 ? sipVsLumpsum(profile.navHistory, window) : null;

  return { profile, metrics, recommendation, sipVsLumpsum: svl };
}
