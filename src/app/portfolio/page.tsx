import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HoldingRow, type HoldingRowData } from "@/components/holding-row";
import { RefreshNavButton } from "@/components/refresh-nav-button";
import { ImportHoldings } from "@/components/import-holdings";
import { prisma } from "@/lib/prisma";
import { valueHoldings } from "@/lib/analysis/valuation";
import { formatINR, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const holdings = await prisma.holding.findMany({
    include: { fund: true },
    orderBy: { investedAmount: "desc" },
  });

  const valued = await valueHoldings(
    holdings.map((h) => ({
      id: h.id,
      units: h.units,
      avgCostNav: h.avgCostNav,
      investedAmount: h.investedAmount,
      amfiCode: h.fund.amfiCode,
    })),
  );

  const totalInvested = [...valued.values()].reduce((a, v) => a + v.invested, 0);
  const totalValue = [...valued.values()].reduce((a, v) => a + v.currentValue, 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? totalGain / totalInvested : null;

  const rows: HoldingRowData[] = holdings.map((h) => {
    const v = valued.get(h.id)!;
    return {
      id: h.id,
      schemeCode: h.fund.amfiCode ? Number(h.fund.amfiCode) : null,
      name: h.fund.name,
      category: h.fund.category ?? null,
      units: h.units,
      avgCostNav: h.avgCostNav,
      invested: v.invested,
      weight: totalValue > 0 ? (v.currentValue / totalValue) * 100 : 0,
      currentValue: v.currentValue,
      gain: v.gain,
      gainPct: v.gainPct,
      valued: v.valued,
      latestNav: v.latestNav,
      navDate: v.navDate,
    };
  });

  const gainColor = totalGain > 0 ? "text-success" : totalGain < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Your mutual fund holdings, valued at latest NAV. Add positions from the{" "}
            <Link href="/analyze" className="text-primary hover:underline">
              Analyze
            </Link>{" "}
            page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshNavButton />
          {rows.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href="/api/export/holdings">
                <Download className="h-4 w-4" /> Export CSV
              </a>
            </Button>
          )}
        </div>
      </div>

      <ImportHoldings />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">Holdings</CardTitle>
              <CardDescription>{rows.length} fund(s), valued at latest NAV</CardDescription>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-xs text-muted-foreground">Invested</div>
                <div className="font-semibold tabular-nums">{formatINR(totalInvested)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Current value</div>
                <div className="font-semibold tabular-nums">{formatINR(totalValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Unrealised gain</div>
                <div className={`font-semibold tabular-nums ${gainColor}`}>
                  {totalGain >= 0 ? "+" : "-"}
                  {formatINR(Math.abs(totalGain))}
                  {totalGainPct != null && ` (${formatPct(totalGainPct, { withSign: true })})`}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No holdings yet. Search a fund under{" "}
              <Link href="/analyze" className="text-primary hover:underline">
                Analyze
              </Link>{" "}
              and use <span className="font-medium">Add to portfolio</span>.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((h) => (
                <HoldingRow key={h.id} h={h} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Current value = units &times; latest NAV (from mfapi, cached). Gains are{" "}
        <span className="font-medium">unrealised</span> and exclude exit load and tax. Funds whose NAV can&apos;t
        be fetched fall back to cost and are marked &ldquo;at cost&rdquo;.
      </p>
    </div>
  );
}
