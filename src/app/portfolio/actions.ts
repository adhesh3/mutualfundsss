"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fetchScheme } from "@/lib/data/mfapi";
import { assetClassFor, classifyCategory } from "@/lib/data/categorize";

/** Identity needed to attach a holding to a fund (the Fund row may not exist yet). */
export interface HoldingFundInput {
  schemeCode: number;
  isin?: string;
  name: string;
  amc?: string;
  category?: string;
  assetClass?: string;
}

export interface HoldingValues {
  units: number;
  avgCostNav: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateHoldingViews() {
  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath("/screener");
}

/** Upsert the Fund row a holding hangs off, returning its id. */
async function ensureFund(fund: HoldingFundInput): Promise<string> {
  const amfiCode = String(fund.schemeCode);
  const row = await prisma.fund.upsert({
    where: { amfiCode },
    create: {
      amfiCode,
      isin: fund.isin,
      name: fund.name,
      amc: fund.amc,
      category: fund.category,
      assetClass: fund.assetClass,
      isWatched: true,
    },
    update: {
      isin: fund.isin,
      amc: fund.amc,
      category: fund.category,
      assetClass: fund.assetClass,
    },
  });
  return row.id;
}

/**
 * Merge a lot into the single holding per fund using a units-weighted average
 * cost (i.e. "I bought more"), creating the holding if it doesn't exist yet.
 */
async function mergeLot(fundId: string, units: number, avgCostNav: number) {
  const existing = await prisma.holding.findFirst({ where: { fundId } });
  if (existing) {
    const totalUnits = existing.units + units;
    const blendedCost = (existing.units * existing.avgCostNav + units * avgCostNav) / totalUnits;
    await prisma.holding.update({
      where: { id: existing.id },
      data: { units: totalUnits, avgCostNav: blendedCost, investedAmount: totalUnits * blendedCost },
    });
  } else {
    await prisma.holding.create({
      data: { fundId, units, avgCostNav, investedAmount: units * avgCostNav },
    });
  }
}

/** Add a position from the Analyze page. */
export async function addHolding(fund: HoldingFundInput, values: HoldingValues): Promise<ActionResult> {
  const units = Number(values.units);
  const avgCostNav = Number(values.avgCostNav);
  if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(avgCostNav) || avgCostNav <= 0) {
    return { ok: false, error: "Enter valid units and average cost NAV." };
  }

  const fundId = await ensureFund(fund);
  await mergeLot(fundId, units, avgCostNav);

  revalidateHoldingViews();
  return { ok: true };
}

export interface ImportResult {
  added: number;
  failed: number;
  errors: string[];
}

/**
 * Bulk-import holdings from CSV text. Each row is `amfiCode,units,avgCostNav`
 * (a header row is auto-skipped). The fund's name/category are auto-filled by
 * looking up the scheme code on mfapi, so the user only needs the code + lot.
 */
export async function importHoldingsCsv(csv: string): Promise<ImportResult> {
  const errors: string[] = [];
  let added = 0;

  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const [i, line] of lines.entries()) {
    const cols = line.split(",").map((c) => c.trim());
    const schemeCode = Number(cols[0]);
    // Skip an obvious header row.
    if (i === 0 && !Number.isFinite(schemeCode)) continue;

    const units = Number(cols[1]);
    const avgCostNav = Number(cols[2]);
    if (!Number.isFinite(schemeCode) || schemeCode <= 0) {
      errors.push(`Row ${i + 1}: invalid AMFI code "${cols[0]}".`);
      continue;
    }
    if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(avgCostNav) || avgCostNav <= 0) {
      errors.push(`Row ${i + 1}: invalid units / avg cost.`);
      continue;
    }

    // Auto-fill identity from mfapi; degrade gracefully if it's unavailable.
    let fund: HoldingFundInput = { schemeCode, name: `Scheme ${schemeCode}` };
    try {
      const scheme = await fetchScheme(schemeCode);
      const category = classifyCategory(scheme.schemeCategoryRaw);
      fund = {
        schemeCode,
        isin: scheme.isin,
        name: scheme.name,
        amc: scheme.amc,
        category,
        assetClass: assetClassFor(category, scheme.schemeCategoryRaw),
      };
    } catch {
      errors.push(`Row ${i + 1}: couldn't look up scheme ${schemeCode}; imported with minimal details.`);
    }

    const fundId = await ensureFund(fund);
    await mergeLot(fundId, units, avgCostNav);
    added++;
  }

  revalidateHoldingViews();
  return { added, failed: errors.length, errors };
}

/** Overwrite a holding's units / average cost (used by the inline editor). */
export async function updateHolding(id: string, formData: FormData) {
  const units = Number(formData.get("units"));
  const avgCostNav = Number(formData.get("avgCostNav"));
  if (!Number.isFinite(units) || units <= 0 || !Number.isFinite(avgCostNav) || avgCostNav <= 0) return;

  await prisma.holding.update({
    where: { id },
    data: { units, avgCostNav, investedAmount: units * avgCostNav },
  });
  revalidateHoldingViews();
}

export async function deleteHolding(id: string) {
  await prisma.holding.delete({ where: { id } });
  revalidateHoldingViews();
}
