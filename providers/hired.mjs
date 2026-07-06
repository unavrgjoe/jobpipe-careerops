// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Hired provider — Hired.com was rebranded to LHH and no longer exposes a public
// job listing API or RSS feed. This provider is a placeholder; it logs a warning
// and returns an empty array. When/if Hired restores public access, implement
// the API fetch here and remove the warning.
//
// Wire in via a `job_boards:` entry with `provider: hired` (or rely on detect).

const HIRED_FEED_URL = 'https://hired.com/feed/jobs';

/** @type {Provider} */
export default {
  id: 'hired',

  detect(entry) {
    const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
    if (url.includes('hired.com/jobs')) {
      return { url: HIRED_FEED_URL };
    }
    return null;
  },

  /**
   * Fetches and normalizes postings — currently returns empty array (no public feed).
   * @param {{ careers_url?: string }} entry
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx
   * @returns {Promise<Array<import('./_types.js').Job>>}
   */
  async fetch(entry, ctx) {
    console.warn('hired: No public API/RSS feed available (Hired rebranded to LHH). Returning empty results.');
    return [];
  },

  normalize(job) {
    return {
      title: job.title || '',
      url: job.url || '',
      company: job.company || '',
      location: job.location || '',
      description: job.description || '',
      postedAt: job.postedAt || undefined,
      source: 'Hired',
    };
  },

  rateLimit: {
    requests: 30,
    window: '1min',
  },
};
