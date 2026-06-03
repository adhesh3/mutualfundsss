"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatNumber, formatPct } from "@/lib/format";
import { updateHolding, deleteHolding } from "@/app/portfolio/actions";

export interface HoldingRowData {
  id: string;
  schemeCode: number | null;
  name: string;
  category: string | null;
  units: number;
  avgCostNav: number;
  invested: number;
  weight: number;
  currentValue: number;
  gain: number;
  gainPct: number | null;
  valued: boolean;
  latestNav: number | null;
  navDate: string | null;
}

export function HoldingRow({ h }: { h: HoldingRowData }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={updateHolding.bind(null, h.id)}
        onSubmit={() => setEditing(false)}
        className="flex flex-wrap items-end gap-2 py-3"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{h.name}</div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`units-${h.id}`} className="text-xs">
            Units
          </Label>
          <Input
            id={`units-${h.id}`}
            name="units"
            type="number"
            step="any"
            min="0"
            defaultValue={h.units}
            className="h-8 w-24"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`nav-${h.id}`} className="text-xs">
            Avg cost NAV
          </Label>
          <Input
            id={`nav-${h.id}`}
            name="avgCostNav"
            type="number"
            step="any"
            min="0"
            defaultValue={h.avgCostNav}
            className="h-8 w-28"
            required
          />
        </div>
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </form>
    );
  }

  const gainColor = h.gain > 0 ? "text-success" : h.gain < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {h.schemeCode ? (
          <Link href={`/analyze?scheme=${h.schemeCode}`} className="truncate font-medium hover:underline">
            {h.name}
          </Link>
        ) : (
          <div className="truncate font-medium">{h.name}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {h.category && <Badge variant="secondary">{h.category}</Badge>}
          <span>
            {formatNumber(h.units, 3)} units @ {formatINR(h.avgCostNav, true)}
          </span>
          {h.valued && h.latestNav != null && (
            <span>
              NAV {formatINR(h.latestNav, true)}
              {h.navDate ? ` · ${h.navDate}` : ""}
            </span>
          )}
        </div>
      </div>
      <div className="hidden text-right sm:block">
        <div className="text-xs text-muted-foreground">{h.weight.toFixed(0)}% of portfolio</div>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, h.weight)}%` }} />
        </div>
      </div>
      <div className="w-32 text-right">
        <div className="font-mono text-sm font-medium tabular-nums">{formatINR(h.currentValue)}</div>
        {h.valued ? (
          <div className={`text-xs tabular-nums ${gainColor}`}>
            {h.gain >= 0 ? "+" : "-"}
            {formatINR(Math.abs(h.gain))}
            {h.gainPct != null && ` (${formatPct(h.gainPct, { withSign: true })})`}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">at cost</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" title="Edit" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
        <form action={deleteHolding.bind(null, h.id)}>
          <Button type="submit" variant="ghost" size="icon" title="Delete">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </form>
      </div>
    </div>
  );
}
