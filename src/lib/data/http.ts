export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(url: string, opts: { timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "fund-analyzer/0.1 (personal)" },
      cache: "no-store",
    });
    if (!res.ok) throw new HttpError(`${url} -> HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(`${url} -> timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch a plain-text resource (e.g. the AMFI NAVAll feed). */
export async function fetchText(url: string, opts: { timeoutMs?: number } = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain", "User-Agent": "fund-analyzer/0.1 (personal)" },
      cache: "no-store",
    });
    if (!res.ok) throw new HttpError(`${url} -> HTTP ${res.status}`, res.status);
    return await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(`${url} -> timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
