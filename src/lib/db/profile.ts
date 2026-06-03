import { prisma } from "@/lib/prisma";
import type { InvestorView } from "@/lib/analysis/recommend";
import type { RiskTolerance } from "@/lib/config";

export async function getOrCreateProfile() {
  const existing = await prisma.investorProfile.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.investorProfile.create({ data: { id: "default" } });
}

export async function getInvestorView(): Promise<InvestorView> {
  const p = await getOrCreateProfile();
  return { riskTolerance: p.riskTolerance as RiskTolerance, horizonYears: p.horizonYears };
}
