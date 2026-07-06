// HTTP transport helpers shared across providers.
// Files prefixed with _ are never loaded as providers by scan.mjs.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; career-ops/1.3)';

// Parse rate strings like "30/min", "100/hour", "10/sec", "30/1min"
function parseRateString(rateStr) {
  const match = rateStr.trim().match(/^(\d+)\s*\/\s*(\d*)(\w+)$/i);
  if (!match) {
    throw new Error(`Invalid rate string: ${rateStr}. Expected format like "30/min"`);
  }

  const [, count, multiplier, unit] = match;
  const countNum = parseInt(count, 10);
  const multNum = multiplier ? parseInt(multiplier, 10) : 1;

  // Convert to tokens per second
  let tokensPerSecond;
  switch (unit.toLowerCase()) {
    case 'sec':
    case 'second':
    case 's':
      tokensPerSecond = (countNum * multNum) / 1000;
      break;
    case 'min':
    case 'minute':
    case 'm':
      tokensPerSecond = (countNum * multNum) / 60 / 1000;
      break;
    case 'hour':
    case 'h':
      tokensPerSecond = (countNum * multNum) / 60 / 60 / 1000;
      break;
    default:
      throw new Error(`Unsupported rate unit: ${unit}`);
  }

  return {
    count: countNum * multNum,
    unit: multiplier ? `${multiplier}${unit}` : unit,
    tokensPerSecond,
  };
}

// Token bucket implementation
function createTokenBucket({ rate, capacity }) {
  const parsed = parseRateString(rate);
  let tokens = capacity;
  let lastRefillTime = Date.now();

  const refillRate = parsed.tokensPerSecond;

  return {
    async acquire(tokensToAcquire = 1) {
      await new Promise(resolve => {
        const check = () => {
          const now = Date.now();
          const elapsed = now - lastRefillTime;
          const refilled = elapsed * refillRate;

          tokens = Math.min(capacity, tokens + refilled);
          lastRefillTime = now;

          if (tokens >= tokensToAcquire) {
            tokens -= tokensToAcquire;
            resolve();
          } else {
            const waitTime = Math.max(1, Math.ceil((tokensToAcquire - tokens) / refillRate));
            setTimeout(check, waitTime);
          }
        };

        check();
      });
    },

    tryAcquire(tokensToAcquire = 1) {
      const now = Date.now();
      const elapsed = now - lastRefillTime;
      const refilled = elapsed * refillRate;

      tokens = Math.min(capacity, tokens + refilled);
      lastRefillTime = now;

      if (tokens >= tokensToAcquire) {
        tokens -= tokensToAcquire;
        return true;
      }

      return false;
    },

    adjustRate(retryAfterMs) {
      // Back off: wait and then reset tokens
      setTimeout(() => {
        tokens = capacity;
        lastRefillTime = Date.now();
      }, retryAfterMs);
    },

    getState() {
      const now = Date.now();
      const elapsed = now - lastRefillTime;
      const refilled = elapsed * refillRate;
      const currentTokens = Math.min(capacity, tokens + refilled);

      return {
        tokens: currentTokens,
        capacity: capacity,
        rate: `${parsed.count}/${parsed.unit}`,
        tokensPerSecond: refillRate,
      };
    },
  };
}

// Retry with exponential backoff + jitter
export async function fetchWithRetry(url, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = 2, baseDelayMs = 1000 } = opts;
  let lastErr;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);
      await new Promise(r => setTimeout(r, backoff));
    }

    try {
      return await fetchWithTimeout(url, { timeoutMs, ...opts });
    } catch (e) {
      lastErr = e;
      if (e.status && e.status >= 400 && e.status < 500) throw e;
      if (e.name === 'AbortError') throw e;
    }
  }

  throw lastErr;
}

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, method = 'GET', body = null, redirect = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    });
    if (!res.ok) {
      const responseText = await res.text().catch(() => '');
      const snippet = responseText.replace(/\s+/g, ' ').trim().slice(0, 300);
      const err = new Error(snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = responseText;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.json();
}

export async function fetchText(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.text();
}

export function parseRateLimitHeaders(headers) {
  const retryAfter = headers.get('Retry-After');
  if (retryAfter) {
    const retryAfterNum = parseInt(retryAfter, 10);
    if (!isNaN(retryAfterNum)) {
      return { retryAfterMs: retryAfterNum * 1000 };
    }
  }

  const rateLimitRemaining = headers.get('X-RateLimit-Remaining');
  const rateLimitReset = headers.get('X-RateLimit-Reset');

  if (rateLimitRemaining && rateLimitReset) {
    const remaining = parseInt(rateLimitRemaining, 10);
    const reset = parseInt(rateLimitReset, 10);
    if (!isNaN(remaining) && !isNaN(reset)) {
      const now = Date.now() / 1000; // Convert to seconds
      const resetAfterMs = Math.max(0, (reset - now)) * 1000;
      return { remaining, resetAfterMs };
    }
  }

  return {};
}

export function makeHttpCtx(rateLimitConfig) {
  const bucket = rateLimitConfig ? createTokenBucket(rateLimitConfig) : null;

  return {
    transport: 'http',
    fetchJson: async (url, opts) => {
      if (bucket) await bucket.acquire();
      return fetchJson(url, opts);
    },
    fetchText: async (url, opts) => {
      if (bucket) await bucket.acquire();
      return fetchText(url, opts);
    },
    parseRateLimitHeaders,
  };
}

export { createTokenBucket, parseRateString };

