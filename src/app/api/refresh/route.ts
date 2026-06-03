import { NextResponse } from "next/server";
import { refreshNavCache } from "@/lib/data/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pre-warm the NAV cache. Intended for a scheduled trigger (e.g. Vercel cron or
 * a local cron curling this endpoint). If CRON_SECRET is set, require it as a
 * Bearer token so the endpoint isn't publicly abusable on a deployed instance.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await refreshNavCache();
  return NextResponse.json({ ok: true, ...result });
}
