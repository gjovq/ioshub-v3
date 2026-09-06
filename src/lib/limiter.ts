/**
 * Limits concurrent outbound requests to the upstream API and enforces a
 * minimum gap between dispatches. Probing showed the service starts timing out
 * when hit with a burst of parallel statistics queries, so every call funnels
 * through here.
 */
export function createLimiter(maxConcurrent: number, minGapMs = 0) {
  let active = 0;
  let lastStart = 0;
  const queue: (() => void)[] = [];

  const next = () => {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (!run) return;
    active++;
    run();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = async () => {
        if (minGapMs > 0) {
          const wait = lastStart + minGapMs - Date.now();
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        }
        lastStart = Date.now();
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          active--;
          next();
        }
      };
      queue.push(start);
      next();
    });
  };
}

/** Retries transient failures (network/5xx) with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 2, baseMs = 400 }: { attempts?: number; baseMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      // never retry a definitive client answer
      if (status && status >= 400 && status < 500) throw err;
      if (i === attempts) break;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
  throw lastErr;
}
