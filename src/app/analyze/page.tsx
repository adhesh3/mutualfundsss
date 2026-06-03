import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavChart } from "@/components/charts/nav-chart";
import { DrawdownChart } from "@/components/charts/drawdown-chart";
import { VerdictCard } from "@/components/verdict-card";
import { WatchlistButton } from "@/components/watchlist-button";
import { AddHoldingForm } from "@/components/add-holding-form";
import { analyzeFund } from "@/lib/analysis/analyze";
import { cleanNavSeries } from "@/lib/analysis/metrics";
import { getInvestorView } from "@/lib/db/profile";
import { formatINRCompact, formatNumber, formatPct } from "@/lib/format";
import { FundSearch } from "./fund-search";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ scheme?: string }>;
}) {
  const { scheme } = await searchParams;
  const schemeCode = scheme ? Number(scheme) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyze a fund</h1>
        <p className="text-sm text-muted-foreground">
          Search any Indian mutual fund. Data is merged from Kuvera, mfdata.in and mfapi.in.
        </p>
      </div>

      <div className="mx-auto max-w-2xl">
        <FundSearch />
      </div>

      {schemeCode && <FundAnalysisView schemeCode={schemeCode} />}

      {!schemeCode && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Search for a fund above to see its metrics, holdings, and a SIP-vs-lumpsum recommendation.
            <div className="mt-2">
              Looking at a new fund offer?{" "}
              <Link href="/nfo" className="text-primary hover:underline">
                Analyze an NFO
              </Link>
              .
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function FundAnalysisView({ schemeCode }: { schemeCode: number }) {
  const investor = await getInvestorView();
  let analysis;
  try {
    analysis = await analyzeFund(schemeCode, investor);
  } catch (err) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          Could not analyze this fund: {err instanceof Error ? err.message : "unknown error"}
        </CardContent>
      </Card>
    );
  }

  const { profile, metrics, recommendation, sipVsLumpsum: svl } = analysis;
  const t = metrics.trailing;
  const cleanHistory = cleanNavSeries(profile.navHistory);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">{profile.identity.name}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                {profile.identity.amc && <span>{profile.identity.amc}</span>}
                {profile.identity.schemeCategoryRaw && (
                  <Badge variant="secondary">{profile.identity.schemeCategoryRaw}</Badge>
                )}
                {profile.identity.fundManager && (
                  <span className="text-xs">Mgr: {profile.identity.fundManager}</span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <WatchlistButton
                  fund={{
                    schemeCode,
                    isin: profile.identity.isin,
                    name: profile.identity.name,
                    amc: profile.identity.amc,
                    category: profile.identity.category,
                    assetClass: profile.identity.assetClass,
                  }}
                />
                <AddHoldingForm
                  fund={{
                    schemeCode,
                    isin: profile.identity.isin,
                    name: profile.identity.name,
                    amc: profile.identity.amc,
                    category: profile.identity.category,
                    assetClass: profile.identity.assetClass,
                  }}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="NAV" value={formatNumber(metrics.latestNav)} hint={metrics.asOf} />
            <Stat label="1Y" value={formatPct(t.y1, { withSign: true })} />
            <Stat label="3Y CAGR" value={formatPct(t.y3Cagr)} />
            <Stat label="5Y CAGR" value={formatPct(t.y5Cagr)} />
            <Stat label="Expense" value={profile.ratios.expenseRatio != null ? `${profile.ratios.expenseRatio}%` : "--"} />
            <Stat label="AUM" value={profile.ratios.aumCr != null ? `Rs ${profile.ratios.aumCr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : "--"} />
          </div>
        </CardContent>
      </Card>

      <VerdictCard rec={recommendation} />

      {cleanHistory.length > 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NAV history</CardTitle>
              <CardDescription>
                Since {cleanHistory[0].date} ({formatNumber(metrics.yearsOfData, 1)} yrs)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NavChart history={cleanHistory} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drawdowns</CardTitle>
              <CardDescription>
                Worst fall: {formatPct(metrics.maxDrawdown)} from a peak
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DrawdownChart history={cleanHistory} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk &amp; return</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Volatility (ann.)" value={formatPct(metrics.annualizedVolatility)} />
            <Stat label="Sharpe" value={formatNumber(metrics.sharpe ?? profile.ratios.sharpe)} />
            <Stat label="Sortino" value={formatNumber(metrics.sortino)} />
            <Stat label="Max drawdown" value={formatPct(metrics.maxDrawdown)} />
            <Stat label="Beta" value={formatNumber(metrics.beta ?? profile.ratios.beta)} />
            <Stat label="Alpha (ann.)" value={formatPct(metrics.alpha ?? (profile.ratios.alpha != null ? profile.ratios.alpha / 100 : undefined))} />
            {metrics.rolling3y && (
              <Stat
                label="Rolling 3Y > RF"
                value={formatPct(metrics.rolling3y.pctAboveRf)}
                hint={`${metrics.rolling3y.count} windows`}
              />
            )}
            {metrics.rolling3y && <Stat label="Rolling 3Y avg" value={formatPct(metrics.rolling3y.avg)} />}
          </CardContent>
        </Card>

        {svl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SIP vs Lumpsum (last {svl.windowYears}y)</CardTitle>
              <CardDescription>
                Backtest of Rs {svl.monthlyAmount.toLocaleString("en-IN")}/month vs the same total as a lumpsum.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="SIP XIRR" value={formatPct(svl.sipXirr)} />
              <Stat label="Lumpsum return" value={formatPct(svl.lumpsumXirr)} />
              <Stat label="SIP corpus" value={`Rs ${formatINRCompact(svl.sipFinalValue)}`} hint={`invested Rs ${formatINRCompact(svl.sipInvested)}`} />
              <Stat label="Lumpsum corpus" value={`Rs ${formatINRCompact(svl.lumpsumFinalValue)}`} hint={`invested Rs ${formatINRCompact(svl.lumpsumInvested)}`} />
            </CardContent>
          </Card>
        )}
      </div>

      {profile.holdings && profile.holdings.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top holdings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.holdings.slice(0, 10).map((h) => (
                <div key={h.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{h.name}</span>
                  <span className="tabular-nums text-muted-foreground">{h.pct.toFixed(1)}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
          {profile.sectors && profile.sectors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sector allocation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile.sectors.slice(0, 10).map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Sources:{" "}
        {profile.provenance.map((p) => `${p.group}=${p.source}${p.asOf ? ` (${p.asOf})` : ""}`).join(", ")}
      </p>
    </div>
  );
}
