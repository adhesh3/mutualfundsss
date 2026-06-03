"use client";
import { useState, useTransition } from "react";
import { PlusCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHolding, type HoldingFundInput } from "@/app/portfolio/actions";

export function AddHoldingForm({ fund }: { fund: HoldingFundInput }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [units, setUnits] = useState("");
  const [nav, setNav] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button
        variant={done ? "secondary" : "outline"}
        size="sm"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      >
        {done ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
        {done ? "In portfolio" : "Add to portfolio"}
      </Button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await addHolding(fund, { units: Number(units), avgCostNav: Number(nav) });
          if (res.ok) {
            setDone(true);
            setOpen(false);
            setUnits("");
            setNav("");
          } else {
            setError(res.error ?? "Could not add holding.");
          }
        });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="h-units" className="text-xs">
          Units
        </Label>
        <Input
          id="h-units"
          type="number"
          step="any"
          min="0"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="h-8 w-24"
          placeholder="100"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="h-nav" className="text-xs">
          Avg buy NAV
        </Label>
        <Input
          id="h-nav"
          type="number"
          step="any"
          min="0"
          value={nav}
          onChange={(e) => setNav(e.target.value)}
          className="h-8 w-28"
          placeholder="65.40"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
        Cancel
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </form>
  );
}
