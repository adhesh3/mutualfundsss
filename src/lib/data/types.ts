import type { AssetClass, FundCategory } from "@/lib/config";

export type DataSource = "kuvera" | "mfdata" | "mfapi";

/** A single NAV observation. `date` is ISO yyyy-mm-dd. */
export interface NavPoint {
  date: string;
  nav: number;
}

export interface FundIdentity {
  schemeCode?: number;
  isin?: string;
  name: string;
  amc?: string;
  schemeType?: string;
  schemeCategoryRaw?: string;
  category?: FundCategory;
  assetClass?: AssetClass;
  fundManager?: string;
  benchmark?: string;
}

/** API-reported returns (fractions, e.g. 0.123 = 12.3%). CAGR for >1y windows. */
export interface ApiReturns {
  m1?: number;
  m3?: number;
  m6?: number;
  y1?: number;
  y3?: number;
  y5?: number;
  inception?: number;
}

export interface FundRatios {
  expenseRatio?: number; // percent (e.g. 0.97)
  aumCr?: number; // crores
  sharpe?: number;
  beta?: number;
  alpha?: number;
  stdDev?: number; // percent
  pe?: number;
  pb?: number;
  volatility?: number; // Kuvera single-figure volatility
  crisilRating?: string;
  morningstar?: number; // 1-5
  fundRating?: number; // 1-5 (Kuvera)
}

export interface SipLumpsumRules {
  sipAvailable?: boolean;
  sipMin?: number;
  sipMax?: number;
  sipDates?: string[];
  sipFrequencies?: string[];
  lumpAvailable?: boolean;
  lumpMin?: number;
  lumpMax?: number;
  stpAvailable?: boolean;
  swpAvailable?: boolean;
  lockInDays?: number;
  exitLoad?: string;
}

export interface HoldingRow {
  name: string;
  pct: number;
  sector?: string;
  assetType?: string;
}

export interface SectorRow {
  name: string;
  pct: number;
}

/** Which source supplied each field group, with freshness. */
export interface Provenance {
  group: "identity" | "navHistory" | "apiReturns" | "ratios" | "rules" | "holdings";
  source: DataSource;
  asOf?: string;
}

/** Normalized, merged view of a fund assembled from all three APIs. */
export interface FundProfile {
  identity: FundIdentity;
  navHistory: NavPoint[];
  apiReturns?: ApiReturns;
  ratios: FundRatios;
  rules: SipLumpsumRules;
  holdings?: HoldingRow[];
  sectors?: SectorRow[];
  provenance: Provenance[];
  warnings: string[];
  fetchedAt: string;
}

export interface SchemeSearchResult {
  schemeCode: number;
  schemeName: string;
  isin?: string;
}
