import { prisma } from "@/lib/prisma";
import type { DataSource } from "./types";

/**
 * Read-through cache backed by the ApiCache table. On a fetch failure we fall
 * back to stale cached data (if any) so the analyzer stays resilient when one
 * of the unofficial upstream APIs is briefly down.
 */
export async function cachedJson<T>(
  source: DataSource,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = await prisma.apiCache.findUnique({
    where: { source_cacheKey: { source, cacheKey: key } },
  });

  if (existing && Date.now() - existing.fetchedAt.getTime() < ttlMs) {
    try {
      return JSON.parse(existing.payload) as T;
    } catch {
      // fall through to refetch on corrupt cache
    }
  }

  try {
    const fresh = await fetcher();
    await prisma.apiCache.upsert({
      where: { source_cacheKey: { source, cacheKey: key } },
      create: { source, cacheKey: key, payload: JSON.stringify(fresh) },
      update: { payload: JSON.stringify(fresh), fetchedAt: new Date() },
    });
    return fresh;
  } catch (err) {
    if (existing) {
      try {
        return JSON.parse(existing.payload) as T;
      } catch {
        // ignore
      }
    }
    throw err;
  }
}
