// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Wellfound (AngelList) provider — hits the public GraphQL API endpoint (auth via env var).
// Auto-detects from `wellfound.com/jobs` or `angel.co/jobs` URLs.
//
// Wellfound's public GraphQL API is rate-limited (~30 requests/min for authenticated requests).
// The default timeout (10s) is sufficient; we add exponential backoff + jitter to dodge rate-limiting.
//
// Rate limit: 30 requests per minute (conservative for public endpoint).
// Auth: process.env.WELLFOUND_API_TOKEN (API token from Wellfound developer portal).

const WELLFOUND_TIMEOUT_MS = 15_000;
const WELLFOUND_RETRIES = 2;
const WELLFOUND_RATE_LIMIT = 30; // requests per minute

/**
 * Detect Wellfound (AngelList) job search URLs.
 * Accepts either a PortalEntry object or a URL string (for direct testing).
 * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  const match = url.match(/(wellfound\.com\/jobs|angel\.co\/jobs)/i);
  if (!match) return null;
  return { url };
}

/**
 * Normalize Wellfound job data to the standard schema.
 * @param {any} job - Raw Wellfound job object from GraphQL response
 * @param {string} boardUrl - Base URL for the job board (used for company attribution)
 * @returns {import('./_types.js').Job}
 */
export function normalize(job, boardUrl) {
  return {
    title: job.title || '',
    url: job.url || '',
    company: job.companyName || '',
    location: job.locations?.map((l) => l.name).join(', ') || '',
    description: job.description || '',
    postedAt: parsePostedDate(job.postedAt),
    source: 'Wellfound',
  };
}

/**
 * Parse Wellfound's postedAt field (ISO 8601 date string) to epoch ms.
 * @param {string} value
 * @returns {number | undefined}
 */
function parsePostedDate(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Build the GraphQL query for Wellfound job search.
 * @param {string} keywords - Search keywords
 * @param {number} count - Number of jobs to return (max 25)
 * @returns {string}
 */
function buildQuery(keywords, count) {
  return `query {
    jobs(query: "${keywords}", first: ${count}, type: full_time) {
      edges {
        node {
          id
          title
          url
          companyName
          locations {
            name
          }
          description
          postedAt
        }
      }
    }
  }`;
}

/**
 * Execute the Wellfound GraphQL search.
 * @param {import('./_types.js').PortalEntry} entry
 * @param {import('./_types.js').Context} ctx
 * @param {string} query - GraphQL query string
 * @param {string} variables - JSON-encoded variables
 * @returns {Promise<any>}
 */
async function executeSearch(entry, ctx, query, variables) {
  const token = process.env.WELLFOUND_API_TOKEN;
  if (!token) {
    throw new Error('wellfound: WELLFOUND_API_TOKEN environment variable is required');
  }

  const apiUrl = 'https://wellfound.com/api/graphql';
  const response = await ctx.fetchJson(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    timeoutMs: WELLFOUND_TIMEOUT_MS,
    redirect: 'error',
  });

  return response;
}

/** @type {Provider} */
export default {
  id: 'wellfound',

  detect,

  normalize,

  async fetch(entry, ctx) {
    const apiUrl = detect(entry)?.url;
    if (!apiUrl) throw new Error(`wellfound: cannot detect URL for ${entry.name}`);

    // Build search query from the board URL (parse keywords from URL)
    const keywords = extractKeywords(apiUrl);
    const count = 25; // Wellfound API limit per request

    let lastErr;
    for (let attempt = 0; attempt <= WELLFOUND_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff + jitter to dodge rate-limiting
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await new Promise(r => setTimeout(r, backoff));
      }

      try {
        const query = buildQuery(keywords, count);
        const variables = {}; // No variables needed for basic search

        const data = await executeSearch(entry, ctx, query, variables);

        // Extract jobs from GraphQL response
        const jobs = data?.jobs?.edges?.map(edge => edge?.node)?.filter(Boolean) || [];

        return jobs.map(j => normalize(j, apiUrl));
      } catch (e) {
        lastErr = e;
        // Don't retry on abort errors or non-retryable client errors (5xx are server errors, retry)
        if (e.name === 'AbortError') throw e;
        // Retry on 5xx errors (server errors) and 429 (rate limit)
        if (e.status && e.status >= 500) continue;
        if (e.status === 429) continue;
        // Don't retry on other 4xx errors
        if (e.status && e.status >= 400 && e.status < 500) throw e;
      }
    }

    throw lastErr;
  },

  rateLimit: {
    requests: WELLFOUND_RATE_LIMIT,
    window: '1min',
  },
};

/**
 * Extract search keywords from Wellfound job search URL.
 * @param {string} url
 * @returns {string}
 */
function extractKeywords(url) {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  const keywords = params.get('keywords') || params.get('q') || '';
  return keywords.trim() || 'Software Engineer';
}
