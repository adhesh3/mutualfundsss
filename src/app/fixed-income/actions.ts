"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function addInstrument(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const principal = Number(formData.get("principal"));
  if (!name || !Number.isFinite(principal) || principal <= 0) return;

  const maturity = formData.get("maturityDate");
  const yieldRaw = formData.get("yieldPct");

  await prisma.fixedIncomeInstrument.create({
    data: {
      kind: String(formData.get("kind") ?? "other"),
      name,
      principal,
      yieldPct: yieldRaw ? Number(yieldRaw) || null : null,
      maturityDate: maturity ? new Date(String(maturity)) : null,
      notes: (formData.get("notes") as string) || null,
    },
  });
  revalidatePath("/fixed-income");
  revalidatePath("/");
}

export async function deleteInstrument(id: string) {
  await prisma.fixedIncomeInstrument.delete({ where: { id } });
  revalidatePath("/fixed-income");
  revalidatePath("/");
}
