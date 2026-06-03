import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getInvestorView } from "@/lib/db/profile";
import { analyzeFund } from "@/lib/analysis/analyze";
import type { Verdict } from "@/lib/analysis/recommend";
import { formatPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const verdictVariant: Record<Verdict, "success" | "warning" | "destructive"> = {
  "Strong Buy": "success",
  Buy: "success",
  Hold: "warning",
  Avoid: "destructive",
};

export default async function ScreenerPage() {
  const investor = await getInvestorView();
  const [watched, held] = await Promise.all([
    prisma.fund.findMany({
      where: { isWatched: true, amfiCode: { not: null } },
      orderBy: { name: "asc" },
    }),
    prisma.holding.findMany({ select: { fund: { select: { amfiCode: true } } } }),
  ]);
  const heldCodes = new Set(held.map((h) => h.fund.amfiCode).filter(Boolean));

  const rows = await Promise.all(
    watched.map(async (f) => {
      const isHeld = heldCodes.has(f.amfiCode);
      try {
        const a = await analyzeFund(Number(f.amfiCode), investor);
        return {
          schemeCode: Number(f.amfiCode),
          name: a.profile.identity.name,
          category: a.profile.identity.schemeCategoryRaw ?? f.category ?? "--",
          score: a.recommendation.score,
          verdict: a.recommendation.verdict,
          mode: a.recommendation.mode.recommendation,
          y3: a.metrics.trailing.y3Cagr,
          held: isHeld,
          ok: true as const,
        };
      } catch {
        return { schemeCode: Number(f.amfiCode), name: f.name, held: isHeld, ok: false as const };
      }
    }),
  );

  const ranked = rows
    .filter((r) => r.ok)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
        <p className="text-sm text-muted-foreground">
          Your watchlist, ranked by the rule-based score for your profile.
        </p>
      </div>

      {watched.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Your watchlist is empty. Go to{" "}
            <Link href="/analyze" className="text-primary hover:underline">
              Analyze
            </Link>{" "}
            and add funds with the Watch button.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ranked.length} funds</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ranked.map((r) => (
                <Link
                  key={r.schemeCode}
                  href={`/analyze?scheme=${r.schemeCode}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent"
                >
                  <div className="w-12 text-center">
                    <div className="text-lg font-bold tabular-nums">{r.score?.toFixed(0)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.held && (
                        <Badge variant="secondary" className="shrink-0">
                          Held
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{r.category}</div>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <div className="tabular-nums">{formatPct(r.y3)}</div>
                    <div className="text-xs text-muted-foreground">3Y CAGR</div>
                  </div>
                  <Badge variant="secondary">{r.mode}</Badge>
                  <Badge variant={verdictVariant[r.verdict as Verdict]}>{r.verdict}</Badge>
                </Link>
              ))}
              {rows.some((r) => !r.ok) && (
                <div className="px-5 py-3 text-xs text-muted-foreground">
                  {rows.filter((r) => !r.ok).length} fund(s) could not be analyzed (data source unavailable).
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
