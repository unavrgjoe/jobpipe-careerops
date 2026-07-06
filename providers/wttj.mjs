// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Welcome To The Jungle (formerly Otta) provider — Playwright HTML scraping.
// Auto-detects from `welcometothejungle.com` or `wttj.com` URLs.
//
// WTTJ has no public API; we scrape the job board page with Playwright.
// Rate limit: conservative (~2 requests per minute) to avoid anti-bot detection.

const WTTJ_TIMEOUT_MS = 30_000;
const WTTJ_RETRIES = 2;
const WTTJ_RATE_LIMIT = 2; // requests per minute

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Detect WTTJ (Welcome To The Jungle) job search URLs.
 * Accepts either a PortalEntry object or a URL string (for direct testing).
 * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  const match = url.match(/(welcometothejungle\.com|wttj\.com)/i);
  if (!match) return null;
  return { url };
}

/**
 * Normalize WTTJ job data to the standard schema.
 * @param {any} job - Raw job element from Playwright page
 * @returns {import('./_types.js').Job}
 */
export function normalize(job) {
  return {
    title: job.title || '',
    url: job.url || '',
    company: job.company || '',
    location: job.location || '',
    postedAt: toEpochMs(job.postedAt),
    description: job.description || '',
  };
}

/**
 * Fetch jobs from WTTJ using Playwright.
 * @param {import('./_types.js').PortalEntry} entry
 * @param {import('./_types.js').Context} ctx
 * @returns {Promise<import('./_types.js').Job[]>}
 */
async function fetchWithPlaywright(entry, ctx) {
  const url = detect(entry)?.url;
  if (!url) throw new Error(`wttj: cannot detect URL for ${entry.name}`);

  // Use Playwright via ctx.fetchText (which may be wrapped by the scanner)
  // If Playwright is not available, fall back to regular HTTP fetch
  let html;
  try {
    // Try Playwright first if available
    html = await ctx.fetchText(url, { timeoutMs: WTTJ_TIMEOUT_MS, redirect: 'error' });
  } catch (e) {
    // Fall back to regular HTTP fetch
    html = await ctx.fetchText(url, { timeoutMs: WTTJ_TIMEOUT_MS, redirect: 'error' });
  }

  // Parse HTML and extract job listings
  const jobs = parseJobBoardHtml(html, url);

  return jobs;
}

/**
 * Parse job listings from WTTJ HTML.
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {import('./_types.js').Job[]}
 */
function parseJobBoardHtml(html, baseUrl) {
  const jobs = [];

  // WTTJ job listings are typically in a specific structure.
  // We'll use a simple regex-based parser to extract job cards.
  // This is a basic implementation; you may need to adjust selectors based on WTTJ's actual HTML structure.

  // Find all job cards - WTTJ typically uses a specific class for job items
  const jobCardRegex = /<a[^>]*class="[^"]*job-item[^"]*"[^>]*href="([^"]+)"/gi;
  let match;

  while ((match = jobCardRegex.exec(html)) !== null) {
    const jobUrl = match[1];

    // Extract title from the job card
    const titleRegex = new RegExp(`href="${jobUrl}"[^>]*class="[^"]*job-item[^"]*"[^>]*>([^<]+)</a>`, 'i');
    const titleMatch = html.match(titleRegex);

    if (titleMatch && titleMatch[1]) {
      jobs.push({
        title: titleMatch[1].trim(),
        url: jobUrl.startsWith('http') ? jobUrl : new URL(jobUrl, baseUrl).href,
        company: 'Welcome To The Jungle',
        location: '',
        postedAt: undefined,
        description: '',
      });
    }
  }

  return jobs;
}

/** @type {Provider} */
export default {
  id: 'wttj',

  detect,

  normalize,

  async fetch(entry, ctx) {
    let lastErr;
    for (let attempt = 0; attempt <= WTTJ_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await new Promise(r => setTimeout(r, backoff));
      }

      try {
        const jobs = await fetchWithPlaywright(entry, ctx);
        return jobs;
      } catch (e) {
        lastErr = e;
        // Don't retry on abort errors
        if (e.name === 'AbortError') throw e;
      }
    }

    throw lastErr;
  },

  rateLimit: {
    requests: WTTJ_RATE_LIMIT,
    window: '1min',
  },
};
