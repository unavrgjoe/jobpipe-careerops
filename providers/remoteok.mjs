// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// RemoteOK provider — board-wide aggregator feed (https://remoteok.com/api).
// Returns the latest ~100 remote postings as a JSON array; index 0 is a
// {last_updated, legal} metadata object and is skipped. scan.mjs applies the
// configured title_filter / location_filter to the returned rows.
//
// Wire in via a `job_boards:` entry with `provider: remoteok`.
// RemoteOK API ToS asks for a follow link-back when republishing — N/A for
// private scanning, but don't redistribute this feed publicly without it.

const FEED_URL = 'https://remoteok.com/api';

// NaN-safe Date.parse — `|| undefined` would also coerce a valid epoch 0.
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Detect RemoteOK URLs.
 * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  const match = url.match(/(remoteok\.com|remoteok\.io)/i);
  if (!match) return null;
  return { url };
}

/**
 * Normalize RemoteOK job data to the standard schema.
 * @param {any} job - Raw job element from RemoteOK API
 * @returns {import('./_types.js').Job}
 */
export function normalize(job) {
  // Extract slug as URL from RemoteOK API
  const slug = job.slug;
  const url = slug ? `https://remoteok.com/${slug}` : '';

  return {
    title: job.position?.trim() || '',
    url: url,
    company: job.company?.trim() || '',
    location: job.tags?.includes('remote') ? 'Remote' : '',
    description: job.description || '',
    postedAt: toEpochMs(job.date) || toEpochMs(job.epoch),
  };
}

/** @type {Provider} */
export default {
  id: 'remoteok',

  detect,

  normalize,

  /**
   * Fetches and normalizes postings from the RemoteOK public feed.
   * @param {{ name?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx - HTTP context.
   * @returns {Promise<import('./_types.js').Job[]>}
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects
    const data = await ctx.fetchJson(FEED_URL, { redirect: 'error' });
    if (!Array.isArray(data)) {
      throw new Error(`remoteok: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
    }

    return data
      .filter(j => j && typeof j === 'object'
        && typeof j.position === 'string' && j.position.trim() !== ''
        && typeof j.slug === 'string' && j.slug.trim() !== '')
      .map(normalize);
  },

  rateLimit: {
    requests: 30,
    window: '1min',
  },
};
