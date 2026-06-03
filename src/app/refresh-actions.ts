"use server";
import { revalidatePath } from "next/cache";
import { refreshNavCache, type RefreshResult } from "@/lib/data/refresh";

/** In-app "Refresh NAVs" trigger (no secret needed — it's a same-session action). */
export async function refreshNavAction(): Promise<RefreshResult> {
  const result = await refreshNavCache();
  revalidatePath("/");
  revalidatePath("/portfolio");
  revalidatePath("/alerts");
  revalidatePath("/screener");
  return result;
}
