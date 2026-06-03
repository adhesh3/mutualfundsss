"use client";
import { useState, useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshNavAction } from "@/app/refresh-actions";

export function RefreshNavButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const r = await refreshNavAction();
            setMsg(`Updated ${r.refreshed}/${r.total}${r.failed ? ` (${r.failed} failed)` : ""}`);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Refresh NAVs
      </Button>
    </div>
  );
}
