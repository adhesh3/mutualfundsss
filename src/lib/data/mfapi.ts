import { CACHE_TTL_MS } from "@/lib/config";
import { cachedJson } from "./cache";
import { fetchJson } from "./http";
import type { NavPoint, SchemeSearchResult } from "./types";

const BASE = "https://api.mfapi.in";

interface MfApiSearchItem {
  schemeCode: number;
  schemeName: string;
  isinGrowth?: string | null;
  isinDivReinvestment?: string | null;
}

interface MfApiScheme {
  meta: {
    fund_house?: string;
    scheme_type?: string;
    scheme_category?: string;
    scheme_code?: number;
    scheme_name?: string;
    isin_growth?: string | null;
    isin_div_reinvestment?: string | null;
  };
  data: { date: string; nav: string }[];
  status: string;
}

export interface MfApiResult {
  schemeCode: number;
  name: string;
  amc?: string;
  schemeType?: string;
  schemeCategoryRaw?: string;
  isin?: string;
  navHistory: NavPoint[];
}

/** dd-mm-yyyy -> yyyy-mm-dd */
function toIso(d: string): string {
  const [dd, mm, yyyy] = d.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

export async function searchSchemes(query: string): Promise<SchemeSearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const items = await cachedJson<MfApiSearchItem[]>("mfapi", `search:${q.toLowerCase()}`, CACHE_TTL_MS.mfapi, () =>
    fetchJson<MfApiSearchItem[]>(`${BASE}/mf/search?q=${encodeURIComponent(q)}`),
  );
  return items.map((it) => ({
    schemeCode: it.schemeCode,
    schemeName: it.schemeName,
    isin: it.isinGrowth ?? undefined,
  }));
}

export async function fetchScheme(schemeCode: number, ttlMs: number = CACHE_TTL_MS.mfapi): Promise<MfApiResult> {
  const raw = await cachedJson<MfApiScheme>("mfapi", `scheme:${schemeCode}`, ttlMs, () =>
    fetchJson<MfApiScheme>(`${BASE}/mf/${schemeCode}`),
  );

  const navHistory: NavPoint[] = (raw.data ?? [])
    .map((row) => ({ date: toIso(row.date), nav: Number(row.nav) }))
    .filter((p) => Number.isFinite(p.nav) && p.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date)); // ascending by date

  return {
    schemeCode,
    name: raw.meta?.scheme_name ?? `Scheme ${schemeCode}`,
    amc: raw.meta?.fund_house ?? undefined,
    schemeType: raw.meta?.scheme_type ?? undefined,
    schemeCategoryRaw: raw.meta?.scheme_category ?? undefined,
    isin: raw.meta?.isin_growth ?? undefined,
    navHistory,
  };
}

/** Fetch only the NAV series for a benchmark proxy (used for beta/alpha). */
export async function fetchNavSeries(schemeCode: number): Promise<NavPoint[]> {
  return (await fetchScheme(schemeCode)).navHistory;
}
