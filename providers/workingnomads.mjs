// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Working Nomads provider — board-wide aggregator feed
// (https://www.workingnomads.com/api/exposed_jobs/). Returns a JSON array of
// postings; scan.mjs applies the configured title_filter / location_filter.
//
// Wire in via a `job_boards:` entry with `provider: workingnomads`.

const FEED_URL = 'https://www.workingnomads.com/api/exposed_jobs/';

/** @type {Provider} */
export default {
  id: 'workingnomads',

  rateLimit: {
    requests: 30,
    window: '1min',
  },

  detect(entry) {
    const url = entry.careers_url || '';
    if (url.includes('workingnomads.com') || url.includes('workingnomads.co')) {
      return { url: FEED_URL };
    }
    return null;
  },

  /**
   * Fetches and normalizes postings from the Working Nomads public feed.
   * @param {{ name?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx - HTTP context.
   * @returns {Promise<Array<{title: string, url: string, company: string, location: string, postedAt?: number}>>}
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects
    const data = await ctx.fetchJson(FEED_URL, { redirect: 'error' });
    if (!Array.isArray(data)) {
      throw new Error(`workingnomads: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
    }

    return data
      .filter(j => j && typeof j === 'object'
        && typeof j.title === 'string' && j.title.trim() !== ''
        && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
      .map(j => this.normalize(j, entry));
  },

  /**
   * Normalizes a job object from Working Nomads to the standard schema.
   * @param {any} job - The job object from the Working Nomads API.
   * @param {import('./_types.js').PortalEntry} entry - The job_boards entry being processed.
   * @returns {import('./_types.js').Job}
   */
  normalize(job, entry) {
    const postedAt = job.date_posted ? Date.parse(job.date_posted) : undefined;
    return {
      title: job.title.trim(),
      url: job.url.trim(),
      company: typeof job.company_name === 'string' && job.company_name.trim() ? job.company_name.trim() : (entry.name || 'Working Nomads'),
      location: typeof job.location === 'string' ? job.location.trim() : '',
      postedAt: Number.isNaN(postedAt) ? undefined : postedAt,
    };
  },
};
