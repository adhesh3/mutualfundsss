"use client";
import { useState, useTransition } from "react";
import { Star, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToWatchlist, type WatchlistInput } from "@/app/analyze/actions";

export function WatchlistButton({ fund }: { fund: WatchlistInput }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Button
      variant={done ? "secondary" : "outline"}
      size="sm"
      disabled={pending || done}
      onClick={() =>
        startTransition(async () => {
          await addToWatchlist(fund);
          setDone(true);
        })
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4" />
      ) : (
        <Star className="h-4 w-4" />
      )}
      {done ? "On watchlist" : "Watch"}
    </Button>
  );
}
