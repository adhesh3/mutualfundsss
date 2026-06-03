"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { RISK_TOLERANCES } from "@/lib/config";

function int(v: FormDataEntryValue | null, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export async function saveProfile(formData: FormData) {
  const riskRaw = String(formData.get("riskTolerance") ?? "moderate");
  const riskTolerance = (RISK_TOLERANCES as readonly string[]).includes(riskRaw) ? riskRaw : "moderate";
  const ageRaw = formData.get("age");

  await prisma.investorProfile.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      riskTolerance,
      age: ageRaw ? int(ageRaw, 0) || null : null,
      horizonYears: int(formData.get("horizonYears"), 7),
      targetEquityPct: int(formData.get("targetEquityPct"), 60),
      targetDebtPct: int(formData.get("targetDebtPct"), 30),
      targetGoldPct: int(formData.get("targetGoldPct"), 10),
    },
    update: {
      riskTolerance,
      age: ageRaw ? int(ageRaw, 0) || null : null,
      horizonYears: int(formData.get("horizonYears"), 7),
      targetEquityPct: int(formData.get("targetEquityPct"), 60),
      targetDebtPct: int(formData.get("targetDebtPct"), 30),
      targetGoldPct: int(formData.get("targetGoldPct"), 10),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/");
  revalidatePath("/fixed-income");
}
