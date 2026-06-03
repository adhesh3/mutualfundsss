import Link from "next/link";
import { LineChart, ListFilter, Landmark, Wallet, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/db/profile";
import { computeAllocation, type AllocationPosition } from "@/lib/analysis/allocation";
import { valueHoldings } from "@/lib/analysis/valuation";
import type { AssetClass } from "@/lib/config";
import { formatINR, formatDate, formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

function AllocBar({ label, current, target }: { label: string; current: number; target: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current.toFixed(0)}% <span className="text-xs">/ {target}% target</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, current)}%` }} />
        <div className="absolute top-0 h-2 w-0.5 bg-foreground/60" style={{ left: `${Math.min(100, target)}%` }} />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const [profile, instruments, holdings, watchedCount] = await Promise.all([
    getOrCreateProfile(),
    prisma.fixedIncomeInstrument.findMany({ orderBy: { maturityDate: "asc" } }),
    prisma.holding.findMany({ include: { fund: true } }),
    prisma.fund.count({ where: { isWatched: true } }),
  ]);

  const valued = await valueHoldings(
    holdings.map((h) => ({
      id: h.id,
      units: h.units,
      avgCostNav: h.avgCostNav,
      investedAmount: h.investedAmount,
      amfiCode: h.fund.amfiCode,
    })),
  );

  const positions: AllocationPosition[] = [
    ...holdings.map((h) => ({
      assetClass: (h.fund.assetClass as AssetClass) ?? "other",
      amount: valued.get(h.id)?.currentValue ?? h.investedAmount ?? h.units * h.avgCostNav,
    })),
    ...instruments.map((i) => ({ assetClass: "debt" as AssetClass, amount: i.principal })),
  ];

  const drift = computeAllocation(positions, {
    equityPct: profile.targetEquityPct,
    debtPct: profile.targetDebtPct,
    goldPct: profile.targetGoldPct,
  });

  const upcoming = instruments
    .filter((i) => i.maturityDate && i.maturityDate.getTime() > Date.now())
    .slice(0, 5);

  const holdingRows = holdings
    .map((h) => {
      const v = valued.get(h.id);
      return {
        id: h.id,
        name: h.fund.name,
        schemeCode: h.fund.amfiCode ? Number(h.fund.amfiCode) : null,
        invested: v?.invested ?? h.investedAmount ?? h.units * h.avgCostNav,
        currentValue: v?.currentValue ?? h.investedAmount ?? h.units * h.avgCostNav,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);
  const totalInvestedHoldings = holdingRows.reduce((a, h) => a + h.invested, 0);
  const totalHoldings = holdingRows.reduce((a, h) => a + h.currentValue, 0);
  const totalHoldingsGain = totalHoldings - totalInvestedHoldings;
  const topHoldings = holdingRows.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {profile.riskTolerance} profile, {profile.horizonYears}-year horizon.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/analyze">
              <LineChart className="h-4 w-4" /> Analyze a fund
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/screener">
              <ListFilter className="h-4 w-4" /> Screener ({watchedCount})
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/alerts">
              <Bell className="h-4 w-4" /> Alerts
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asset allocation</CardTitle>
            <CardDescription>
              {drift.total > 0
                ? `Tracked portfolio: ${formatINR(drift.total)}`
                : "Add holdings or fixed income to track your allocation vs target."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AllocBar label="Equity" current={drift.current.equity} target={drift.target.equity} />
            <AllocBar label="Debt" current={drift.current.debt} target={drift.target.debt} />
            <AllocBar label="Gold" current={drift.current.gold} target={drift.target.gold} />
            {drift.nudges.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                {drift.nudges.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Fixed income</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/fixed-income">
                  <Landmark className="h-4 w-4" /> Manage
                </Link>
              </Button>
            </div>
            <CardDescription>Upcoming maturities</CardDescription>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No upcoming maturities tracked.</p>
            ) : (
              <div className="divide-y">
                {upcoming.map((i) => (
                  <div key={i.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.yieldPct != null ? `${i.yieldPct}% | ` : ""}
                        {formatDate(i.maturityDate)}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums">{formatINR(i.principal)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Mutual fund holdings</CardTitle>
              <CardDescription>
                {totalHoldings > 0 ? (
                  <>
                    Value {formatINR(totalHoldings)} ·{" "}
                    <span
                      className={
                        totalHoldingsGain > 0
                          ? "text-success"
                          : totalHoldingsGain < 0
                            ? "text-destructive"
                            : ""
                      }
                    >
                      {totalHoldingsGain >= 0 ? "+" : "-"}
                      {formatINR(Math.abs(totalHoldingsGain))}
                      {totalInvestedHoldings > 0 &&
                        ` (${formatPct(totalHoldingsGain / totalInvestedHoldings, { withSign: true })})`}
                    </span>
                  </>
                ) : (
                  "Add positions from the Analyze page to track them here."
                )}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/portfolio">
                <Wallet className="h-4 w-4" /> Manage
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {topHoldings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No holdings tracked yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topHoldings.map((h) => {
                const weight = totalHoldings > 0 ? (h.currentValue / totalHoldings) * 100 : 0;
                return (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      {h.schemeCode ? (
                        <Link href={`/analyze?scheme=${h.schemeCode}`} className="truncate hover:underline">
                          {h.name}
                        </Link>
                      ) : (
                        <span className="truncate">{h.name}</span>
                      )}
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, weight)}%` }} />
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="font-mono tabular-nums">{formatINR(h.currentValue)}</div>
                      <div className="text-xs text-muted-foreground">{weight.toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <Badge>1</Badge>
            <span>
              Set your{" "}
              <Link href="/profile" className="text-primary hover:underline">
                profile
              </Link>{" "}
              (risk &amp; horizon).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge>2</Badge>
            <span>
              <Link href="/analyze" className="text-primary hover:underline">
                Analyze
              </Link>{" "}
              funds and add them to your watchlist.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge>3</Badge>
            <span>
              Track{" "}
              <Link href="/fixed-income" className="text-primary hover:underline">
                fixed income
              </Link>{" "}
              to balance risk.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
