import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getOrCreateProfile } from "@/lib/db/profile";
import { suggestTargetAllocation } from "@/lib/analysis/allocation";
import type { RiskTolerance } from "@/lib/config";
import { saveProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const p = await getOrCreateProfile();
  const suggestion = suggestTargetAllocation({
    riskTolerance: p.riskTolerance as RiskTolerance,
    horizonYears: p.horizonYears,
    age: p.age,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Investor profile</h1>
        <p className="text-sm text-muted-foreground">
          Drives the suitability check, recommended allocation, and SIP-vs-lumpsum guidance.
        </p>
      </div>

      <Card>
        <form action={saveProfile}>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="riskTolerance">Risk tolerance</Label>
                <Select id="riskTolerance" name="riskTolerance" defaultValue={p.riskTolerance}>
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="horizonYears">Horizon (years)</Label>
                <Input id="horizonYears" name="horizonYears" type="number" min={1} max={40} defaultValue={p.horizonYears} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Age (optional)</Label>
                <Input id="age" name="age" type="number" min={18} max={100} defaultValue={p.age ?? ""} />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="font-medium">Suggested target: {suggestion.equityPct}% equity / {suggestion.debtPct}% debt / {suggestion.goldPct}% gold</div>
              <p className="mt-1 text-xs text-muted-foreground">{suggestion.rationale}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="targetEquityPct">Target equity %</Label>
                <Input id="targetEquityPct" name="targetEquityPct" type="number" min={0} max={100} defaultValue={p.targetEquityPct} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetDebtPct">Target debt %</Label>
                <Input id="targetDebtPct" name="targetDebtPct" type="number" min={0} max={100} defaultValue={p.targetDebtPct} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="targetGoldPct">Target gold %</Label>
                <Input id="targetGoldPct" name="targetGoldPct" type="number" min={0} max={100} defaultValue={p.targetGoldPct} />
              </div>
            </div>
          </CardContent>
          <CardContent>
            <Button type="submit">Save profile</Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How targets are used</CardTitle>
          <CardDescription>
            The dashboard and Fixed Income page compare your actual holdings against these targets and flag drift.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
