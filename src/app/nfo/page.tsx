import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { VerdictCard } from "@/components/verdict-card";
import { prisma } from "@/lib/prisma";
import { getInvestorView } from "@/lib/db/profile";
import { analyzeNfo, nfoWindowStatus } from "@/lib/analysis/nfo";
import type { FundCategory } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { createNfo, deleteNfo } from "./actions";

export const dynamic = "force-dynamic";

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

const windowVariant: Record<string, "success" | "warning" | "secondary"> = {
  Open: "success",
  Upcoming: "warning",
  Closed: "secondary",
  Unknown: "secondary",
};

export default async function NfoPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const investor = await getInvestorView();

  const [analysis, nfos] = await Promise.all([
    id ? analyzeNfo(id, investor) : Promise.resolve(null),
    prisma.fund.findMany({ where: { isNfo: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Fund Offers (NFOs)</h1>
        <p className="text-sm text-muted-foreground">
          NFOs have no track record, so they can&apos;t be scored on returns or risk. This is a qualitative,
          cautious read based on mandate, cost, and the AMC.
        </p>
      </div>

      {analysis && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">{analysis.fund.name}</CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                    {analysis.fund.amc && <span>{analysis.fund.amc}</span>}
                    {analysis.fund.category && (
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[analysis.fund.category as FundCategory] ?? analysis.fund.category}
                      </Badge>
                    )}
                    {analysis.fund.fundManager && (
                      <span className="text-xs">Mgr: {analysis.fund.fundManager}</span>
                    )}
                  </CardDescription>
                </div>
                {(() => {
                  const w = nfoWindowStatus(analysis.fund);
                  return <Badge variant={windowVariant[w.label]}>{w.label}</Badge>;
                })()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Subscription opens</div>
                  <div className="mt-0.5 font-semibold">{formatDate(analysis.fund.nfoOpen)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Subscription closes</div>
                  <div className="mt-0.5 font-semibold">{formatDate(analysis.fund.nfoClose)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Stated expense ratio</div>
                  <div className="mt-0.5 font-semibold">
                    {analysis.fund.nfoTerPct != null ? `${analysis.fund.nfoTerPct}%` : "--"}
                  </div>
                </div>
              </div>
              {analysis.fund.nfoMandate && (
                <p className="mt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mandate:</span> {analysis.fund.nfoMandate}
                </p>
              )}
            </CardContent>
          </Card>

          <VerdictCard rec={analysis.recommendation} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add an NFO</CardTitle>
          <CardDescription>Enter what the offer document discloses. Everything but the name is optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createNfo} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="name">Fund name</Label>
              <Input id="name" name="name" placeholder="e.g. XYZ Innovation Fund" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amc">AMC</Label>
              <Input id="amc" name="amc" placeholder="e.g. XYZ Mutual Fund" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue="flexicap">
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fundManager">Fund manager</Label>
              <Input id="fundManager" name="fundManager" placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfoTerPct">Stated TER %</Label>
              <Input id="nfoTerPct" name="nfoTerPct" type="number" step="any" min="0" placeholder="e.g. 1.8" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfoOpen">Opens</Label>
              <Input id="nfoOpen" name="nfoOpen" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nfoClose">Closes</Label>
              <Input id="nfoClose" name="nfoClose" type="date" />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="nfoMandate">Mandate / strategy</Label>
              <Input id="nfoMandate" name="nfoMandate" placeholder="What will the fund invest in?" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit">Add NFO</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracked NFOs</CardTitle>
        </CardHeader>
        <CardContent>
          {nfos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No NFOs added yet.</p>
          ) : (
            <div className="divide-y">
              {nfos.map((n) => {
                const w = nfoWindowStatus(n);
                return (
                  <div key={n.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/nfo?id=${n.id}`} className="truncate font-medium hover:underline">
                        {n.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {n.amc && <span>{n.amc}</span>}
                        {n.category && (
                          <Badge variant="secondary">
                            {CATEGORY_LABELS[n.category as FundCategory] ?? n.category}
                          </Badge>
                        )}
                        <Badge variant={windowVariant[w.label]}>{w.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/nfo?id=${n.id}`}>Analyze</Link>
                      </Button>
                      <form action={deleteNfo.bind(null, n.id)}>
                        <Button type="submit" variant="ghost" size="icon" title="Delete">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
