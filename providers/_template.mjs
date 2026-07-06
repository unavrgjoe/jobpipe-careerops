// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Template provider — minimal boilerplate for new providers.
//
// Copy this file as `providers/myprovider.mjs` and implement:
// - detect(entry) — return {url} or null
// - fetch(entry, ctx) — return Job[]
//
// See existing providers for examples: greenhouse.mjs, ashby.mjs, lever.mjs.

/** @type {Provider} */
export default {
  id: 'template',

  detect(entry) {
    // Return null to skip auto-detection; implement resolveApiUrl() if needed.
    return null;
  },

  async fetch(entry, ctx) {
    // Example: fetch from public API and map to Job[]
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`template: cannot derive API URL for ${entry.name}`);

    // Use ctx.fetchJson() for JSON APIs
    const json = await ctx.fetchJson(apiUrl, { redirect: 'error' });

    // Map API response to Job objects
    if (!Array.isArray(json)) return [];
    return json.map(j => ({
      title: j.title || '',
      url: j.absolute_url || j.jobUrl || '',
      company: entry.name,
      location: j.location || '',
      postedAt: toEpochMs(j.publishedAt || j.firstPublished),
    }));
  },
};

// Helper: resolve API URL from careers_url or explicit api field
/** @param {import('./_types.js').PortalEntry} entry */
function resolveApiUrl(entry) {
  if (entry.api) return entry.api;
  const url = entry.careers_url || '';
  // Implement URL pattern matching for your provider here
  return null;
}

// Helper: epoch ms from ISO string or timestamp
function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
