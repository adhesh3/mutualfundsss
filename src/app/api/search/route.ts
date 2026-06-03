import { NextResponse } from "next/server";
import { searchSchemes } from "@/lib/data/merge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 3) return NextResponse.json({ results: [] });
  try {
    const results = await searchSchemes(q);
    return NextResponse.json({ results: results.slice(0, 25) });
  } catch (err) {
    return NextResponse.json(
      { results: [], error: err instanceof Error ? err.message : "search failed" },
      { status: 502 },
    );
  }
}
