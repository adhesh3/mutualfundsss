import type { Fund } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ASSET_CLASS_BY_CATEGORY, type AssetClass, type FundCategory } from "@/lib/config";
import { formatDate } from "@/lib/format";
import type { FundProfile } from "@/lib/data/types";
import { recommendNfo, type InvestorView, type Recommendation } from "./recommend";

export interface NfoAnalysis {
  fund: Fund;
  profile: FundProfile;
  recommendation: Recommendation;
}

/** Describe where the subscription window sits relative to today. */
export function nfoWindowStatus(fund: Pick<Fund, "nfoOpen" | "nfoClose">): {
  label: "Upcoming" | "Open" | "Closed" | "Unknown";
  note: string;
} {
  const now = Date.now();
  const open = fund.nfoOpen?.getTime();
  const close = fund.nfoClose?.getTime();

  if (open == null && close == null) return { label: "Unknown", note: "Subscription window not set." };
  if (open != null && now < open) {
    return { label: "Upcoming", note: `Subscription opens ${formatDate(fund.nfoOpen)}.` };
  }
  if (close != null && now > close) {
    return { label: "Closed", note: `Subscription closed ${formatDate(fund.nfoClose)}.` };
  }
  return {
    label: "Open",
    note: `Subscription open${fund.nfoClose ? ` until ${formatDate(fund.nfoClose)}` : ""}.`,
  };
}

/** Build the minimal FundProfile that `recommendNfo` needs from a stored NFO row. */
export function buildNfoProfile(fund: Fund): FundProfile {
  const category = (fund.category ?? "other") as FundCategory;
  const assetClass: AssetClass =
    (fund.assetClass as AssetClass) ?? ASSET_CLASS_BY_CATEGORY[category] ?? "other";

  const window = nfoWindowStatus(fund);
  const warnings: string[] = [`NFO status: ${window.label}. ${window.note}`];
  if (fund.nfoMandate) warnings.push(`Stated mandate: ${fund.nfoMandate}`);

  return {
    identity: {
      name: fund.name,
      isin: fund.isin ?? undefined,
      amc: fund.amc ?? undefined,
      category,
      assetClass,
      schemeCategoryRaw: fund.category ?? undefined,
      fundManager: fund.fundManager ?? undefined,
    },
    navHistory: [],
    ratios: { expenseRatio: fund.nfoTerPct ?? undefined },
    rules: {},
    provenance: [],
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

export async function analyzeNfo(fundId: string, investor: InvestorView): Promise<NfoAnalysis | null> {
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund || !fund.isNfo) return null;

  const profile = buildNfoProfile(fund);
  const recommendation = recommendNfo(profile, investor);
  return { fund, profile, recommendation };
}
