import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/db/profile";
import { suggestedDebtCategories, suggestTargetAllocation } from "@/lib/analysis/allocation";
import type { RiskTolerance } from "@/lib/config";
import { formatINR, formatDate } from "@/lib/format";
import { addInstrument, deleteInstrument } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  fd: "Fixed Deposit",
  gsec: "G-Sec",
  corp_bond: "Corporate Bond",
  debt_fund: "Debt Fund",
  ppf: "PPF",
  epf: "EPF",
  other: "Other",
};

export default async function FixedIncomePage() {
  const [profile, instruments] = await Promise.all([
    getOrCreateProfile(),
    prisma.fixedIncomeInstrument.findMany({ orderBy: { maturityDate: "asc" } }),
  ]);

  const allocation = suggestTargetAllocation({
    riskTolerance: profile.riskTolerance as RiskTolerance,
    horizonYears: profile.horizonYears,
    age: profile.age,
  });
  const debtGuide = suggestedDebtCategories(profile.horizonYears);
  const total = instruments.reduce((a, i) => a + i.principal, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fixed income &amp; risk</h1>
        <p className="text-sm text-muted-foreground">
          Allocation guidance plus your manually tracked bonds, FDs and debt instruments.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended allocation</CardTitle>
            <CardDescription>{allocation.rationale}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex overflow-hidden rounded-lg border text-center text-sm font-medium">
              <div className="bg-primary/15 py-3 text-primary" style={{ width: `${allocation.equityPct}%` }}>
                {allocation.equityPct}%
              </div>
              <div className="bg-success/15 py-3 text-success" style={{ width: `${allocation.debtPct}%` }}>
                {allocation.debtPct}%
              </div>
              <div className="bg-warning/20 py-3 text-[hsl(38_92%_38%)]" style={{ width: `${allocation.goldPct}%` }}>
                {allocation.goldPct}%
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Equity</span>
              <span>Debt</span>
              <span>Gold</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Debt categories for your {profile.horizonYears}y horizon</CardTitle>
            <CardDescription>{debtGuide.note}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {debtGuide.categories.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add an instrument</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addInstrument} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="space-y-1.5 lg:col-span-1">
              <Label htmlFor="kind">Type</Label>
              <Select id="kind" name="kind" defaultValue="fd">
                {Object.entries(KIND_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g. SBI 5-yr FD" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="principal">Amount (Rs)</Label>
              <Input id="principal" name="principal" type="number" min={1} step="any" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yieldPct">Yield %</Label>
              <Input id="yieldPct" name="yieldPct" type="number" step="any" placeholder="7.1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maturityDate">Maturity</Label>
              <Input id="maturityDate" name="maturityDate" type="date" />
            </div>
            <div className="lg:col-span-6">
              <Button type="submit">Add</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your fixed income</CardTitle>
            <span className="text-sm font-semibold tabular-nums">{formatINR(total)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {instruments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No instruments yet.</p>
          ) : (
            <div className="divide-y">
              {instruments.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{KIND_LABELS[i.kind] ?? i.kind}</Badge>
                      {i.yieldPct != null && <span>{i.yieldPct}% yield</span>}
                      {i.maturityDate && <span>matures {formatDate(i.maturityDate)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums">{formatINR(i.principal)}</span>
                    <form action={deleteInstrument.bind(null, i.id)}>
                      <Button type="submit" variant="ghost" size="icon" title="Delete">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
