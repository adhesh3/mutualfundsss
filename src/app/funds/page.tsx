import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { WatchlistButton } from "@/components/watchlist-button";
import { AddHoldingForm } from "@/components/add-holding-form";
import { prisma } from "@/lib/prisma";
import type { FundCategory } from "@/lib/config";
import { formatPct, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const CATEGORY_LABELS: Record<FundCategory, string> = {
  largecap: "Large Cap",
  midcap: "Mid Cap",
  smallcap: "Small Cap",
  flexicap: "Flexi Cap",
  elss: "ELSS",
  index: "Index",
  hybrid: "Hybrid",
  liquid: "Liquid",
  short_duration: "Short Duration",
  corporate: "Corporate Bond",
  gilt: "Gilt",
  other: "Other",
};

const SORTS = ["r3y", "r1y", "r5y", "name", "latestNav"] as const;
type SortKey = (typeof SORTS)[number];

type Search = {
  category?: string;
  plan?: string;
  kind?: string;
  amc?: string;
  q?: string;
  sort?: string;
  page?: string;
};

function qs(base: Search, override: Partial<Search>): string {
  const merged = { ...base, ...override };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== "all") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `/funds?${s}` : "/funds";
}

export default async function FundsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const category = params.category ?? "all";
  const plan = params.plan ?? "direct";
  const kind = params.kind ?? "growth";
  const amc = params.amc ?? "all";
  const q = params.q ?? "";
  const sort: SortKey = (SORTS as readonly string[]).includes(params.sort ?? "") ? (params.sort as SortKey) : "r3y";
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.FundCatalogEntryWhereInput = {
    ...(category !== "all" ? { category } : {}),
    ...(plan !== "all" ? { plan } : {}),
    ...(kind !== "all" ? { kind } : {}),
    ...(amc !== "all" ? { amc } : {}),
    ...(q.trim() ? { name: { contains: q.trim() } } : {}),
  };

  const orderBy: Prisma.FundCatalogEntryOrderByWithRelationInput =
    sort === "name" ? { name: "asc" } : sort === "latestNav" ? { latestNav: "desc" } : { [sort]: "desc" };

  const [total, totalAll, amcs, rows] = await Promise.all([
    prisma.fundCatalogEntry.count({ where }),
    prisma.fundCatalogEntry.count(),
    prisma.fundCatalogEntry.findMany({
      distinct: ["amc"],
      where: { amc: { not: null } },
      select: { amc: true },
      orderBy: { amc: "asc" },
    }),
    prisma.fundCatalogEntry.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentParams: Search = { category, plan, kind, amc, q, sort, page: String(page) };

  if (totalAll === 0) {
    return (
      <div className="space-y-6">
        <Header total={0} />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            The fund catalog hasn&apos;t been built yet. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5">npm run precompute</code> (with the dev server running)
            or hit <code className="rounded bg-muted px-1 py-0.5">/api/precompute</code> to load the universe from
            AMFI and price the funds.
          </CardContent>
        </Card>
      </div>
    );
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <Link href={qs(currentParams, { sort: k, page: "1" })} className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sort === k ? "text-primary" : "text-muted-foreground/50"}`} />
    </Link>
  );

  return (
    <div className="space-y-6">
      <Header total={total} />

      <Card>
        <CardContent className="pt-6">
          <form action="/funds" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="q">Search name</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="e.g. flexi cap, bluechip" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={category}>
                <option value="all">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plan</Label>
              <Select id="plan" name="plan" defaultValue={plan}>
                <option value="direct">Direct</option>
                <option value="regular">Regular</option>
                <option value="all">All</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind">Type</Label>
              <Select id="kind" name="kind" defaultValue={kind}>
                <option value="growth">Growth</option>
                <option value="idcw">IDCW</option>
                <option value="all">All</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amc">AMC</Label>
              <Select id="amc" name="amc" defaultValue={amc}>
                <option value="all">All AMCs</option>
                {amcs.map((a) => (
                  <option key={a.amc} value={a.amc!}>
                    {a.amc}
                  </option>
                ))}
              </Select>
            </div>
            <div className="lg:col-span-6">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total.toLocaleString("en-IN")} fund{total === 1 ? "" : "s"}
            {pages > 1 && <span className="text-muted-foreground"> · page {page} of {pages}</span>}
          </CardTitle>
          <CardDescription>Returns are precomputed for Direct-Growth equity &amp; hybrid funds; others show NAV only.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium"><SortHeader label="Fund" k="name" /></th>
                  <th className="px-3 py-2 text-right font-medium"><SortHeader label="NAV" k="latestNav" /></th>
                  <th className="px-3 py-2 text-right font-medium"><SortHeader label="1Y" k="r1y" /></th>
                  <th className="px-3 py-2 text-right font-medium"><SortHeader label="3Y" k="r3y" /></th>
                  <th className="px-3 py-2 text-right font-medium"><SortHeader label="5Y" k="r5y" /></th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.schemeCode} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/analyze?scheme=${f.schemeCode}`} className="font-medium hover:underline">
                        {f.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {f.amc && <span className="truncate">{f.amc}</span>}
                        {f.category && <Badge variant="secondary">{CATEGORY_LABELS[f.category as FundCategory] ?? f.category}</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(f.latestNav)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPct(f.r1y)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatPct(f.r3y)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatPct(f.r5y)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/analyze?scheme=${f.schemeCode}`}>Analyze</Link>
                        </Button>
                        <WatchlistButton
                          fund={{
                            schemeCode: f.schemeCode,
                            isin: f.isin ?? undefined,
                            name: f.name,
                            amc: f.amc ?? undefined,
                            category: f.category ?? undefined,
                            assetClass: f.assetClass ?? undefined,
                          }}
                        />
                        <AddHoldingForm
                          fund={{
                            schemeCode: f.schemeCode,
                            isin: f.isin ?? undefined,
                            name: f.name,
                            amc: f.amc ?? undefined,
                            category: f.category ?? undefined,
                            assetClass: f.assetClass ?? undefined,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No funds match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                <Link href={qs(currentParams, { page: String(page - 1) })} aria-disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Link>
              </Button>
              <span className="text-muted-foreground">Page {page} of {pages}</span>
              <Button asChild variant="outline" size="sm" disabled={page >= pages}>
                <Link href={qs(currentParams, { page: String(page + 1) })} aria-disabled={page >= pages}>
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Header({ total }: { total: number }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Explore funds</h1>
      <p className="text-sm text-muted-foreground">
        Browse the whole universe by category and returns{total ? "" : ""} — no need to know the name. Click any fund
        to analyze, watch, or add it.
      </p>
    </div>
  );
}
