import { CACHE_TTL_MS } from "@/lib/config";
import { cachedJson } from "./cache";
import { fetchJson } from "./http";
import type { ApiReturns, FundRatios, SipLumpsumRules } from "./types";

const BASE = "https://mf.captnemo.in";

interface KuveraReturns {
  date?: string;
  week_1?: number;
  year_1?: number;
  year_3?: number;
  year_5?: number;
  inception?: number;
}

interface KuveraSip {
  sip_frequency?: string;
}

interface KuveraPlan {
  ISIN?: string;
  aum?: number;
  category?: string;
  fund_category?: string;
  fund_type?: string;
  crisil_rating?: string;
  expense_ratio?: string | number;
  fund_manager?: string;
  fund_house?: string;
  fund_name?: string;
  fund_rating?: number;
  investment_objective?: string;
  name?: string;
  lock_in_period?: number;
  lump_available?: string;
  lump_min?: number;
  lump_max?: number;
  sip_available?: string;
  sip_min?: number;
  sip_max?: number;
  sip_dates?: string[];
  sips?: KuveraSip[];
  stp_flag?: string;
  swp_flag?: string;
  start_date?: string;
  volatility?: number;
  returns?: KuveraReturns;
  tags?: string[];
}

export interface KuveraResult {
  isin?: string;
  name?: string;
  amc?: string;
  fundManager?: string;
  category?: string;
  fundType?: string;
  objective?: string;
  startDate?: string;
  tags?: string[];
  returns: ApiReturns;
  ratios: Pick<FundRatios, "expenseRatio" | "aumCr" | "crisilRating" | "fundRating" | "volatility">;
  rules: SipLumpsumRules;
}

const yn = (v?: string) => (v == null ? undefined : v.toUpperCase() === "Y");
const pct = (v?: number) => (v == null ? undefined : v / 100);

export async function fetchKuvera(isin: string): Promise<KuveraResult | null> {
  const arr = await cachedJson<KuveraPlan[]>("kuvera", `isin:${isin}`, CACHE_TTL_MS.kuvera, () =>
    fetchJson<KuveraPlan[]>(`${BASE}/kuvera/${encodeURIComponent(isin)}`),
  );
  const p = Array.isArray(arr) ? arr[0] : null;
  if (!p) return null;

  return {
    isin: p.ISIN ?? isin,
    name: p.name ?? p.fund_name,
    amc: p.fund_house,
    fundManager: p.fund_manager,
    category: p.fund_category ?? p.category,
    fundType: p.fund_type,
    objective: p.investment_objective,
    startDate: p.start_date,
    tags: p.tags,
    returns: {
      y1: pct(p.returns?.year_1),
      y3: pct(p.returns?.year_3),
      y5: pct(p.returns?.year_5),
      inception: pct(p.returns?.inception),
    },
    ratios: {
      expenseRatio: p.expense_ratio != null ? Number(p.expense_ratio) : undefined,
      // Kuvera reports AUM in lakhs; normalize to crore.
      aumCr: p.aum != null ? p.aum / 100 : undefined,
      crisilRating: p.crisil_rating,
      fundRating: p.fund_rating,
      volatility: p.volatility,
    },
    rules: {
      sipAvailable: yn(p.sip_available),
      sipMin: p.sip_min,
      sipMax: p.sip_max,
      sipDates: p.sip_dates,
      sipFrequencies: p.sips?.map((s) => s.sip_frequency).filter(Boolean) as string[] | undefined,
      lumpAvailable: yn(p.lump_available),
      lumpMin: p.lump_min,
      lumpMax: p.lump_max,
      stpAvailable: yn(p.stp_flag),
      swpAvailable: yn(p.swp_flag),
      lockInDays: p.lock_in_period,
    },
  };
}
