import { NextResponse } from "next/server";
import { precomputeCatalog } from "@/lib/data/catalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Refresh the fund catalog (AMFI) and incrementally fill trailing returns.
 * Intended for a scheduled trigger (Vercel cron / local curl). `?cap=` bounds
 * how many funds get (re)priced this run. CRON_SECRET (if set) is required.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const capParam = new URL(request.url).searchParams.get("cap");
  const returnsCap = capParam && Number.isFinite(Number(capParam)) ? Number(capParam) : undefined;

  const result = await precomputeCatalog({ returnsCap });
  return NextResponse.json({ ok: true, ...result });
}
