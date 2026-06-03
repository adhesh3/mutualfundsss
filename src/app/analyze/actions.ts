"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface WatchlistInput {
  schemeCode: number;
  isin?: string;
  name: string;
  amc?: string;
  category?: string;
  assetClass?: string;
}

export async function addToWatchlist(input: WatchlistInput) {
  const amfiCode = String(input.schemeCode);
  await prisma.fund.upsert({
    where: { amfiCode },
    create: {
      amfiCode,
      isin: input.isin,
      name: input.name,
      amc: input.amc,
      category: input.category,
      assetClass: input.assetClass,
      isWatched: true,
    },
    update: {
      isWatched: true,
      isin: input.isin,
      amc: input.amc,
      category: input.category,
      assetClass: input.assetClass,
    },
  });
  revalidatePath("/screener");
  revalidatePath("/");
}

export async function removeFromWatchlist(schemeCode: number) {
  await prisma.fund.updateMany({
    where: { amfiCode: String(schemeCode) },
    data: { isWatched: false },
  });
  revalidatePath("/screener");
  revalidatePath("/");
}
