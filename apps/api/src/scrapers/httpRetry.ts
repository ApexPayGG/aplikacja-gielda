const DEFAULT_ATTEMPTS = 4;
const BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isRetryableFetchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|429|rate limit/i.test(msg);
}

/**
 * fetch wrapper with exponential backoff for 429 / 5xx / network timeouts.
 */
export async function fetchWithProviderRetry(
  provider: string,
  url: string,
  init?: RequestInit,
  attempts = DEFAULT_ATTEMPTS,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (isRetryableHttpStatus(res.status) && attempt < attempts) {
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "provider_http_retry",
            provider,
            status: res.status,
            attempt,
            delayMs: delay,
          }),
        );
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!isRetryableFetchError(err) || attempt >= attempts) throw err;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "provider_network_retry",
          provider,
          attempt,
          delayMs: delay,
          err: err instanceof Error ? err.message : String(err),
        }),
      );
      await sleep(delay);
    }
  }
  throw lastErr ?? new Error(`${provider} fetch failed`);
}
