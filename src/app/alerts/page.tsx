import Link from "next/link";
import { TrendingDown, Scale, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getInvestorView, getOrCreateProfile } from "@/lib/db/profile";
import { analyzeFund } from "@/lib/analysis/analyze";
import { buySignalFor, maturityReminders, type BuySignal } from "@/lib/analysis/signals";
import { computeAllocation, type AllocationPosition } from "@/lib/analysis/allocation";
import { valueHoldings } from "@/lib/analysis/valuation";
import type { AssetClass } from "@/lib/config";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [investor, profile, watched, holdings, instruments] = await Promise.all([
    getInvestorView(),
    getOrCreateProfile(),
    prisma.fund.findMany({ where: { isWatched: true, amfiCode: { not: null } } }),
    prisma.holding.findMany({ include: { fund: true } }),
    prisma.fixedIncomeInstrument.findMany({ orderBy: { maturityDate: "asc" } }),
  ]);

  // --- Buy signals (watched funds off their peak) ---
  const signals = (
    await Promise.all(
      watched.map(async (f) => {
        try {
          const a = await analyzeFund(Number(f.amfiCode), investor);
          return buySignalFor(Number(f.amfiCode), a);
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((s): s is BuySignal => s !== null)
    .sort((a, b) => b.drawdown - a.drawdown);

  // --- Rebalance alerts (allocation drift at market value) ---
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

  // --- Maturity reminders ---
  const maturities = maturityReminders(instruments);

  const totalAlerts = signals.length + drift.nudges.length + maturities.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts &amp; signals</h1>
        <p className="text-sm text-muted-foreground">
          Actionable nudges from your watchlist, allocation, and fixed income.
        </p>
      </div>

      {totalAlerts === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing needs attention right now. Buy signals appear when watched funds fall off their peak,
            and rebalance alerts when your allocation drifts from target.
          </CardContent>
        </Card>
      )}

      {signals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-success" /> Buy signals
            </CardTitle>
            <CardDescription>Watched funds trading below their peak (weak-rated funds excluded).</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {signals.map((s) => (
                <Link
                  key={s.schemeCode}
                  href={`/analyze?scheme=${s.schemeCode}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent"
                >
                  <div className="w-14 text-center">
                    <div className="text-lg font-bold tabular-nums text-success">
                      -{(s.drawdown * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">off peak</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.name}</span>
                      {s.strength === "strong" && <Badge variant="success">Strong</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{s.message}</div>
                  </div>
                  <Badge variant="secondary">{s.mode}</Badge>
                  <Badge variant={s.verdict === "Hold" ? "warning" : "success"}>{s.verdict}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {drift.nudges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-warning" /> Rebalance alerts
            </CardTitle>
            <CardDescription>
              Your allocation has drifted from target (
              <Link href="/profile" className="text-primary hover:underline">
                edit targets
              </Link>
              ).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {drift.nudges.map((n, i) => (
                <li key={i} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  {n}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {maturities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" /> Maturing soon
            </CardTitle>
            <CardDescription>Fixed-income instruments maturing in the next 90 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {maturities.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      in {m.daysToMaturity} day{m.daysToMaturity === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums">{formatINR(m.principal)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
