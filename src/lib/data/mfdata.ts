import { CACHE_TTL_MS } from "@/lib/config";
import { cachedJson } from "./cache";
import { fetchJson } from "./http";
import type { FundRatios, HoldingRow, SectorRow } from "./types";

const BASE = "https://mfdata.in/api/v1";

// The mfdata payloads are loosely documented, so parse defensively.
type Json = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

/** Case-insensitive lookup across a few candidate keys in an object. */
function pick(obj: Json | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
  for (const k of keys) {
    const hit = lower[k.toLowerCase()];
    if (hit != null) return hit;
  }
  return undefined;
}

export interface MfDataScheme {
  familyId?: number;
  expenseRatio?: number;
  aumCr?: number;
  morningstar?: number;
  ratios: Pick<FundRatios, "sharpe" | "beta" | "alpha" | "stdDev" | "pe" | "pb">;
}

export async function fetchScheme(amfiCode: number): Promise<MfDataScheme | null> {
  const raw = await cachedJson<Json>("mfdata", `scheme:${amfiCode}`, CACHE_TTL_MS.mfdata, () =>
    fetchJson<Json>(`${BASE}/schemes/${amfiCode}`),
  );
  const data = (raw?.data ?? raw) as Json | undefined;
  if (!data) return null;

  const ratiosObj = (pick(data, "ratios") as Json) ?? data;

  return {
    familyId: num(pick(data, "family_id", "familyId")),
    expenseRatio: num(pick(data, "expense_ratio", "expenseRatio", "ter")),
    aumCr: num(pick(data, "aum_cr", "aum", "aumCr")),
    morningstar: num(pick(data, "morningstar", "star_rating", "rating")),
    ratios: {
      sharpe: num(pick(ratiosObj, "sharpe", "sharpe_ratio")),
      beta: num(pick(ratiosObj, "beta")),
      alpha: num(pick(ratiosObj, "alpha")),
      stdDev: num(pick(ratiosObj, "std_dev", "sd", "standard_deviation", "stdDev")),
      pe: num(pick(ratiosObj, "pe", "p_e", "pe_ratio")),
      pb: num(pick(ratiosObj, "pb", "p_b", "pb_ratio")),
    },
  };
}

export async function fetchHoldings(
  familyId: number,
): Promise<{ holdings: HoldingRow[]; sectors: SectorRow[] }> {
  const raw = await cachedJson<Json>("mfdata", `holdings:${familyId}`, CACHE_TTL_MS.mfdata, () =>
    fetchJson<Json>(`${BASE}/families/${familyId}/holdings`),
  );
  const list = (Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []) as Json[];

  const holdings: HoldingRow[] = list
    .map((row) => ({
      name: String(pick(row, "name", "company", "instrument", "security") ?? "Unknown"),
      pct: num(pick(row, "percentage", "weight", "pct", "allocation", "corpus_per")) ?? 0,
      sector: pick(row, "sector", "industry") as string | undefined,
      assetType: pick(row, "asset_type", "type", "instrument_type") as string | undefined,
    }))
    .filter((h) => h.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  const bySector = new Map<string, number>();
  for (const h of holdings) {
    if (!h.sector) continue;
    bySector.set(h.sector, (bySector.get(h.sector) ?? 0) + h.pct);
  }
  const sectors: SectorRow[] = [...bySector.entries()]
    .map(([name, pct]) => ({ name, pct }))
    .sort((a, b) => b.pct - a.pct);

  return { holdings, sectors };
}
