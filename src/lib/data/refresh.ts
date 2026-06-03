import { prisma } from "@/lib/prisma";
import { fetchScheme } from "./mfapi";

export interface RefreshResult {
  total: number;
  refreshed: number;
  failed: number;
}

/**
 * Pre-warm the NAV cache for every fund that matters (watchlist + actual
 * holdings) by force-refetching from mfapi (ttl 0 bypasses the cache, but a
 * fetch failure still falls back to the existing cached payload). Meant to be
 * run on a schedule so pages load instantly with fresh NAVs.
 */
export async function refreshNavCache(): Promise<RefreshResult> {
  const funds = await prisma.fund.findMany({
    where: {
      amfiCode: { not: null },
      OR: [{ isWatched: true }, { holdings: { some: {} } }],
    },
    select: { amfiCode: true },
  });

  const codes = [...new Set(funds.map((f) => f.amfiCode).filter((c): c is string => !!c))];

  let refreshed = 0;
  let failed = 0;
  await Promise.all(
    codes.map(async (code) => {
      try {
        await fetchScheme(Number(code), 0);
        refreshed++;
      } catch {
        failed++;
      }
    }),
  );

  return { total: codes.length, refreshed, failed };
}
