// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// LinkedIn provider — hits the public GraphQL endpoint (no-auth, session cookie required).
// Auto-detects from `linkedin.com/jobs` or `linkedin.com/jobs/search` URLs.
//
// LinkedIn's public GraphQL endpoint is rate-limited (~30 requests/min for unauthenticated
// requests without a session cookie). The default timeout (10s) is sufficient; we add
// exponential backoff + jitter to dodge rate-limiting.
//
// Rate limit: 30 requests per minute (conservative for public endpoint).
// Cookie: process.env.LINKEDIN_SESSION_COOKIE (session cookie from LinkedIn login).

const LINKEDIN_TIMEOUT_MS = 15_000;
const LINKEDIN_RETRIES = 2;
const LINKEDIN_RATE_LIMIT = 30; // requests per minute

/**
 * Detect LinkedIn job search URLs.
 * Accepts either a PortalEntry object or a URL string (for direct testing).
 * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  const match = url.match(/linkedin\.com\/jobs(?:\/search)?(?:\?.*)?$/i);
  if (!match) return null;
  return { url };
}

/**
 * Normalize LinkedIn job data to the standard schema.
 * @param {any} job - Raw LinkedIn job object from GraphQL response
 * @param {string} boardUrl - Base URL for the job board (used for company attribution)
 * @returns {import('./_types.js').Job}
 */
export function normalize(job, boardUrl) {
  return {
    title: job.title || '',
    url: job.shareUrl || job.journeyUrl || '',
    company: job.companyName || '',
    location: job.locationName || '',
    description: job.description || '',
    postedAt: parsePostedDate(job.postedAt),
    source: 'LinkedIn',
  };
}

/**
 * Parse LinkedIn's postedAt field (ISO 8601 date string) to epoch ms.
 * @param {string} value
 * @returns {number | undefined}
 */
function parsePostedDate(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Build the GraphQL query for LinkedIn job search.
 * @param {string} keywords - Search keywords
 * @param {number} count - Number of jobs to return (max 25)
 * @returns {string}
 */
function buildQuery(keywords, count) {
  return `query {
    search(
      query: "${keywords}"
      first: ${count}
      type: JOBS
    ) {
      edges {
        node {
          id
          title
          companyName
          description
          locationName
          postedAt
          shareUrl
          journeyUrl
        }
      }
    }
  }`;
}

/**
 * Execute the LinkedIn GraphQL search.
 * @param {import('./_types.js').PortalEntry} entry
 * @param {import('./_types.js').Context} ctx
 * @param {string} query - GraphQL query string
 * @param {string} variables - JSON-encoded variables
 * @returns {Promise<any>}
 */
async function executeSearch(entry, ctx, query, variables) {
  const cookie = process.env.LINKEDIN_SESSION_COOKIE;
  if (!cookie) {
    throw new Error('linkedin: LINKEDIN_SESSION_COOKIE environment variable is required');
  }

  const apiUrl = 'https://www.linkedin.com/graphql';
  const response = await ctx.fetchJson(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ query, variables }),
    timeoutMs: LINKEDIN_TIMEOUT_MS,
    redirect: 'error',
  });

  return response;
}

/** @type {Provider} */
export default {
  id: 'linkedin',

  detect,

  normalize,

  async fetch(entry, ctx) {
    const apiUrl = detect(entry)?.url;
    if (!apiUrl) throw new Error(`linkedin: cannot detect URL for ${entry.name}`);

    // Build search query from the board URL (parse keywords from URL)
    const keywords = extractKeywords(apiUrl);
    const count = 25; // LinkedIn API limit per request

    let lastErr;
    for (let attempt = 0; attempt <= LINKEDIN_RETRIES; attempt++) {
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
        const jobs = data?.search?.edges?.map(edge => edge?.node)?.filter(Boolean) || [];

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
    requests: LINKEDIN_RATE_LIMIT,
    window: '1min',
  },
};

/**
 * Extract search keywords from LinkedIn job search URL.
 * @param {string} url
 * @returns {string}
 */
function extractKeywords(url) {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  const keywords = params.get('keywords') || params.get('q') || '';
  return keywords.trim() || 'Software Engineer';
}
