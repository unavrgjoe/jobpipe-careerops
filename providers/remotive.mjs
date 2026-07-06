// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Remotive provider — board-wide aggregator feed
// (https://remotive.com/api/remote-jobs). Returns { jobs: [...] }. The full
// feed (no ?search=) is fetched so scan.mjs's title_filter can gate on the
// configured AI/ML titles; the feed's own ?search= is too narrow (a substring
// match that misses e.g. "ML Engineer").
//
// Wire in via a `job_boards:` entry with `provider: remotive`.

const FEED_URL = 'https://remotive.com/api/remote-jobs';
const TRUSTED_HOST = 'remotive.com';

/** @param {string} url */
function assertRemotiveUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`remotive: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`remotive: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`remotive: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

/**
 * Normalize a single Remotive job.
 * @param {any} j
 * @returns {import('./_types.js').Job}
 */
export function normalize(j) {
  if (!j || typeof j !== 'object') {
    return { title: '', url: '', company: '', location: '' };
  }

  const title = typeof j.title === 'string' ? j.title.trim() : '';
  const url = typeof j.url === 'string' ? j.url.trim() : '';
  const company = typeof j.company_name === 'string' && j.company_name.trim()
    ? j.company_name.trim()
    : 'Remotive';
  const location = typeof j.candidate_required_location === 'string'
    ? j.candidate_required_location.trim()
    : '';
  const postedAt = j.publication_date ? Date.parse(j.publication_date) : undefined;

  return {
    title: title || '',
    url: url || '',
    company,
    location,
    postedAt: Number.isNaN(postedAt) ? undefined : postedAt,
  };
}

/**
 * Detect Remotive URLs.
 * @param {import('./_types.js').PortalEntry|string} entry
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  if (url.includes('remotive.com')) {
    return { url: FEED_URL };
  }
  return null;
}

/** @type {Provider} */
export default {
  id: 'remotive',

  detect,

  /**
   * Fetches and normalizes postings from the Remotive public feed.
   * @param {{ name?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx - HTTP context.
   * @returns {Promise<Array<import('./_types.js').Job>>}
   */
  async fetch(entry, ctx) {
    const feedUrl = assertRemotiveUrl(FEED_URL);
    const json = await ctx.fetchJson(feedUrl, { redirect: 'error' });
    if (!json || !Array.isArray(json.jobs)) {
      throw new Error(`remotive: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
    }

    return json.jobs
      .filter(j => j && typeof j === 'object'
        && typeof j.title === 'string' && j.title.trim() !== ''
        && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
      .map(j => normalize(j));
  },

  normalize,

  rateLimit: {
    requests: 30,
    window: '1min',
  },
};
