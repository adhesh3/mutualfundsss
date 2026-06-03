import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recommendation, Verdict } from "@/lib/analysis/recommend";
import { ArrowRightLeft, CalendarClock, Target } from "lucide-react";

const verdictStyle: Record<Verdict, { badge: string; ring: string }> = {
  "Strong Buy": { badge: "bg-success/15 text-success", ring: "ring-success/40" },
  Buy: { badge: "bg-success/15 text-success", ring: "ring-success/30" },
  Hold: { badge: "bg-warning/20 text-[hsl(38_92%_38%)]", ring: "ring-warning/30" },
  Avoid: { badge: "bg-destructive/10 text-destructive", ring: "ring-destructive/30" },
};

function PillarBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-success" : score >= 45 ? "bg-warning" : "bg-destructive";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.round(score)}%` }} />
    </div>
  );
}

export function VerdictCard({ rec }: { rec: Recommendation }) {
  const style = verdictStyle[rec.verdict];
  return (
    <Card className={cn("ring-1", style.ring)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-lg px-3 py-1.5 text-lg font-bold", style.badge)}>{rec.verdict}</span>
            {rec.isNfo && <Badge variant="warning">NFO - qualitative only</Badge>}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">{rec.score.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">/ 100 score</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" /> How to invest
            </div>
            <div className="font-semibold">{rec.mode.recommendation}</div>
            <p className="mt-1 text-xs text-muted-foreground">{rec.mode.rationale}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Time horizon
            </div>
            <div className="font-semibold">
              {rec.horizon.minYears}-{rec.horizon.idealYears}+ years
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{rec.horizon.rationale}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Fit for you
            </div>
            <div className={cn("font-semibold", rec.suitability.fits ? "text-success" : "text-warning")}>
              {rec.suitability.fits ? "Suitable" : "Caution"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{rec.suitability.note}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Why this score</div>
          {rec.pillars.map((p) => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {p.score.toFixed(0)} <span className="text-xs">x {(p.weight * 100).toFixed(0)}%</span>
                </span>
              </div>
              <PillarBar score={p.score} />
              <p className="text-xs text-muted-foreground">{p.reason}</p>
            </div>
          ))}
        </div>

        {rec.notes.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              {rec.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
