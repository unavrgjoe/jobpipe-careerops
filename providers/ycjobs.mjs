// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// YC Jobs provider — Y Combinator's job board (https://ycombinator.com/jobs).
// Fetches job listings from the public HTML page and normalizes to the standard schema.
// Wire in via a `job_boards:` entry with `provider: ycjobs`.

const BASE_URL = 'https://ycombinator.com/jobs';
const JOB_ROW_SELECTOR = '.job-row';
const JOB_TITLE_SELECTOR = '.job-title';
const JOB_COMPANY_SELECTOR = '.job-company';
const JOB_LOCATION_SELECTOR = '.job-location';
const JOB_POSTED_SELECTOR = '.job-posted';

/** @type {Provider} */
export default {
  id: 'ycjobs',

  /**
   * Detect YC Jobs URLs.
   * Accepts either a PortalEntry object or a URL string (for direct testing).
   * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
   * @returns {{ url: string } | null}
   */
  detect(entry) {
    const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
    if (!url) return null;
    const urlLower = url.toLowerCase();
    if (urlLower.includes('ycombinator.com/jobs') || urlLower.includes('workatastartup.com')) {
      return { url };
    }
    return null;
  },

  /**
   * Fetches and normalizes job listings from YC Jobs page.
   * @param {{ name?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchText: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<string> }} ctx - HTTP context.
   * @returns {Promise<Array<{title: string, url: string, company: string, location: string, postedAt?: number}>>}
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects
    const html = await ctx.fetchText(BASE_URL, { redirect: 'error' });

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find all job rows
    const jobRows = doc.querySelectorAll(JOB_ROW_SELECTOR);
    if (jobRows.length === 0) {
      return [];
    }

    // Normalize each job
    const jobs = [];
    for (const row of jobRows) {
      const titleElem = row.querySelector(JOB_TITLE_SELECTOR);
      const companyElem = row.querySelector(JOB_COMPANY_SELECTOR);
      const locationElem = row.querySelector(JOB_LOCATION_SELECTOR);
      const postedElem = row.querySelector(JOB_POSTED_SELECTOR);

      const title = titleElem?.textContent?.trim() || '';
      const company = companyElem?.textContent?.trim() || '';
      const location = locationElem?.textContent?.trim() || '';
      const postedText = postedElem?.textContent?.trim() || '';

      // Skip if no title
      if (!title) continue;

      // Extract URL from title element's href
      const url = titleElem?.querySelector('a')?.href || '';

      // Parse posted date
      let postedAt = undefined;
      if (postedText) {
        postedAt = parsePostedDate(postedText);
      }

      jobs.push({
        title,
        url,
        company: company || (entry.name || 'YC Jobs'),
        location,
        ...(postedAt !== undefined && { postedAt }),
      });
    }

    return jobs;
  },
};

/**
 * Parse a posted date string to epoch ms.
 * Supports formats like "Posted 2 days ago", "Posted today", "1 hour ago", etc.
 * @param {string} text - The posted date text.
 * @returns {number | undefined} Epoch ms or undefined if parsing fails.
 */
function parsePostedDate(text) {
  // Try to match relative time patterns
  const patterns = [
    // "Posted 2 days ago"
    { regex: /(\d+)\s+days?\s+ago/i, multiplier: 24 * 60 * 60 * 1000 },
    // "Posted 1 day ago"
    { regex: /(\d+)\s+hour\s+ago/i, multiplier: 60 * 60 * 1000 },
    // "Posted today"
    { regex: /today/i, multiplier: 0 },
    // "Posted yesterday"
    { regex: /yesterday/i, multiplier: 24 * 60 * 60 * 1000 },
  ];

  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (isNaN(num)) continue;

      const now = Date.now();
      const daysAgo = multiplier === 0 ? 0 : num * multiplier;
      return now - daysAgo;
    }
  }

  return undefined;
}
