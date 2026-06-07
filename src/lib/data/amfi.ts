import type { AssetClass, FundCategory } from "@/lib/config";
import { assetClassFor, classifyCategory } from "./categorize";
import { fetchText } from "./http";

const NAVALL_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

export type FundPlan = "direct" | "regular" | "other";
export type FundKind = "growth" | "idcw" | "other";

export interface CatalogEntry {
  schemeCode: number;
  name: string;
  amc?: string;
  categoryRaw?: string;
  category: FundCategory;
  assetClass: AssetClass;
  isin?: string;
  plan: FundPlan;
  kind: FundKind;
  latestNav?: number;
  navDate?: string;
}

function detectPlan(name: string): FundPlan {
  if (/\bdirect\b/i.test(name)) return "direct";
  if (/\bregular\b/i.test(name)) return "regular";
  return "other";
}

function detectKind(name: string): FundKind {
  if (/idcw|dividend|payout|reinvest/i.test(name)) return "idcw";
  if (/growth/i.test(name)) return "growth";
  return "other";
}

const clean = (s: string | undefined): string | undefined => {
  const t = s?.trim();
  return t && t !== "-" ? t : undefined;
};

/**
 * Parse the AMFI NAVAll feed. The file is grouped: a category header line
 * (text with parentheses, e.g. "Open Ended Schemes(Equity Scheme - Flexi Cap
 * Fund)"), then an AMC name line, then semicolon-delimited data rows:
 * `code;ISIN payout/growth;ISIN reinvest;name;nav;date`.
 */
export function parseNavAll(text: string): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  let currentCategoryRaw: string | undefined;
  let currentAmc: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.includes(";")) {
      const cols = line.split(";");
      const schemeCode = Number(cols[0]);
      if (!Number.isFinite(schemeCode)) continue; // header row ("Scheme Code;...")
      const name = clean(cols[3]);
      if (!name) continue;

      const category = classifyCategory(currentCategoryRaw);
      out.push({
        schemeCode,
        name,
        amc: currentAmc,
        categoryRaw: currentCategoryRaw,
        category,
        assetClass: assetClassFor(category, currentCategoryRaw),
        isin: clean(cols[1]) ?? clean(cols[2]),
        plan: detectPlan(name),
        kind: detectKind(name),
        latestNav: Number.isFinite(Number(cols[4])) ? Number(cols[4]) : undefined,
        navDate: clean(cols[5]),
      });
      continue;
    }

    // Non-data line: a category header (has parentheses) or an AMC name.
    const paren = line.match(/\(([^)]+)\)\s*$/);
    if (paren) {
      currentCategoryRaw = paren[1].trim();
    } else {
      currentAmc = line;
    }
  }

  return out;
}

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const text = await fetchText(NAVALL_URL, { timeoutMs: 45_000 });
  return parseNavAll(text);
}
