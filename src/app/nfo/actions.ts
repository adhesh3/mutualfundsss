"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ASSET_CLASS_BY_CATEGORY, type FundCategory } from "@/lib/config";

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createNfo(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const category = String(formData.get("category") ?? "other") as FundCategory;
  const terRaw = formData.get("nfoTerPct");

  await prisma.fund.create({
    data: {
      name,
      amc: (formData.get("amc") as string)?.trim() || null,
      category,
      assetClass: ASSET_CLASS_BY_CATEGORY[category] ?? "other",
      isNfo: true,
      isWatched: false,
      nfoOpen: parseDate(formData.get("nfoOpen")),
      nfoClose: parseDate(formData.get("nfoClose")),
      nfoMandate: (formData.get("nfoMandate") as string)?.trim() || null,
      fundManager: (formData.get("fundManager") as string)?.trim() || null,
      nfoTerPct: terRaw ? Number(terRaw) || null : null,
    },
  });
  revalidatePath("/nfo");
}

export async function deleteNfo(id: string) {
  await prisma.fund.delete({ where: { id } });
  revalidatePath("/nfo");
}
