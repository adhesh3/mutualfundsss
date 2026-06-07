import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchCatalog, type CatalogEntry } from "./amfi";
import { fetchKuvera } from "./kuvera";

/** Returns are precomputed for this (most-browsed) slice to keep the job bounded. */
const RETURNS_ASSET_CLASSES = ["equity", "hybrid"];
const RETURNS_STALE_MS = 20 * 60 * 60 * 1000; // refresh returns at most ~daily
const DEFAULT_RETURNS_CAP = 300; // max funds to (re)price per run
const RETURNS_CONCURRENCY = 5;
const UPSERT_CHUNK = 500;

export interface PrecomputeResult {
  catalogUpserted: number;
  returnsUpdated: number;
  returnsRemaining: number;
}

/** Upsert catalog rows, preserving any precomputed returns on existing rows. */
export async function upsertCatalog(entries: CatalogEntry[]): Promise<number> {
  let count = 0;
  for (let i = 0; i < entries.length; i += UPSERT_CHUNK) {
    const chunk = entries.slice(i, i + UPSERT_CHUNK);
    await prisma.$transaction(
      chunk.map((e) => {
        const fields = {
          name: e.name,
          amc: e.amc,
          categoryRaw: e.categoryRaw,
          category: e.category,
          assetClass: e.assetClass,
          isin: e.isin,
          plan: e.plan,
          kind: e.kind,
          latestNav: e.latestNav,
          navDate: e.navDate,
        };
        return prisma.fundCatalogEntry.upsert({
          where: { schemeCode: e.schemeCode },
          create: { schemeCode: e.schemeCode, ...fields },
          update: fields, // returns columns intentionally untouched
        });
      }),
    );
    count += chunk.length;
  }
  return count;
}

/** Fill 1/3/5Y returns from Kuvera for stale/unpriced funds in the returns universe. */
async function fillReturns(cap: number): Promise<{ updated: number; remaining: number }> {
  const staleCutoff = new Date(Date.now() - RETURNS_STALE_MS);
  const where: Prisma.FundCatalogEntryWhereInput = {
    plan: "direct",
    kind: "growth",
    assetClass: { in: RETURNS_ASSET_CLASSES },
    isin: { not: null },
    OR: [{ returnsAt: null }, { returnsAt: { lt: staleCutoff } }],
  };

  const remainingTotal = await prisma.fundCatalogEntry.count({ where });
  const todo = await prisma.fundCatalogEntry.findMany({
    where,
    orderBy: { returnsAt: "asc" }, // nulls (never priced) first
    take: cap,
    select: { schemeCode: true, isin: true },
  });

  let updated = 0;
  for (let i = 0; i < todo.length; i += RETURNS_CONCURRENCY) {
    const batch = todo.slice(i, i + RETURNS_CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const k = await fetchKuvera(row.isin!);
          if (!k) return;
          await prisma.fundCatalogEntry.update({
            where: { schemeCode: row.schemeCode },
            data: {
              r1y: k.returns.y1 ?? null,
              r3y: k.returns.y3 ?? null,
              r5y: k.returns.y5 ?? null,
              returnsSource: "kuvera",
              returnsAt: new Date(),
            },
          });
          updated++;
        } catch {
          // Source hiccup — leave this fund for a later run.
        }
      }),
    );
  }

  return { updated, remaining: Math.max(0, remainingTotal - updated) };
}

/**
 * Refresh the fund catalog from AMFI and incrementally fill trailing returns.
 * Bounded per run (returnsCap) so it can run on a serverless cron without
 * overrunning time limits or hammering the unofficial APIs.
 */
export async function precomputeCatalog(
  opts: { returnsCap?: number; skipReturns?: boolean } = {},
): Promise<PrecomputeResult> {
  const entries = await fetchCatalog();
  const catalogUpserted = await upsertCatalog(entries);

  let returnsUpdated = 0;
  let returnsRemaining = 0;
  if (!opts.skipReturns) {
    const r = await fillReturns(opts.returnsCap ?? DEFAULT_RETURNS_CAP);
    returnsUpdated = r.updated;
    returnsRemaining = r.remaining;
  }

  return { catalogUpserted, returnsUpdated, returnsRemaining };
}
