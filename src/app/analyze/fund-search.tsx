"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SchemeSearchResult } from "@/lib/data/types";

export function FundSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SchemeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        /* ignore aborted/failed */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function select(r: SchemeSearchResult) {
    setOpen(false);
    setQ(r.schemeName);
    router.push(`/analyze?scheme=${r.schemeCode}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search a mutual fund (e.g. Parag Parikh Flexi Cap)..."
          className="h-11 pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-card shadow-lg">
          {results.map((r) => (
            <button
              key={r.schemeCode}
              onClick={() => select(r)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {r.schemeName}
            </button>
          ))}
        </div>
      )}
      {open && !loading && q.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-card p-3 text-sm text-muted-foreground shadow-lg">
          No matches. Try the AMC or scheme name.
        </div>
      )}
    </div>
  );
}
