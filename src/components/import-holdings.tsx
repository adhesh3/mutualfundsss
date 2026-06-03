"use client";
import { useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importHoldingsCsv, type ImportResult } from "@/app/portfolio/actions";

export function ImportHoldings() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-sm font-medium">Import holdings from CSV</div>
      <p className="text-xs text-muted-foreground">
        One row per fund: <code>amfiCode,units,avgCostNav</code>. Fund names are looked up automatically. A header
        row is optional.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={"amfiCode,units,avgCostNav\n120503,250.5,42.1\n119598,100,65.4"}
        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending || !csv.trim()}
          onClick={() =>
            startTransition(async () => {
              setResult(null);
              const r = await importHoldingsCsv(csv);
              setResult(r);
              if (r.added > 0 && r.errors.length === 0) {
                setCsv("");
                setOpen(false);
              }
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {result && (
        <div className="text-xs text-muted-foreground">
          Imported {result.added} holding{result.added === 1 ? "" : "s"}
          {result.failed > 0 && `, ${result.failed} issue(s)`}.
          {result.errors.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-destructive">
              {result.errors.slice(0, 6).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
