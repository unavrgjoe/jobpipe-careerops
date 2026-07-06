
// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

import { fetchWithRetry } from './_http.mjs';
import { DOMParser } from 'xmldom';

const GLASSDOOR_RSS_URL = 'https://www.glassdoor.com/Job/rss.htm';
const TRUSTED_HOST = 'www.glassdoor.com';

/** @param {string} url */
function assertGlassdoorUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`glassdoor: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`glassdoor: URL must use HTTPS: ${url}`);
  if (parsed.hostname !== TRUSTED_HOST) {
    throw new Error(`glassdoor: untrusted hostname "${parsed.hostname}" — must be ${TRUSTED_HOST}`);
  }
  return url;
}

// Helper to safely extract text content from a DOM node
const getTextContent = (node, tag) => {
  const element = node.getElementsByTagName(tag)[0];
  return element ? element.textContent : null;
};

/**
 * Normalize a Glassdoor RSS item to the standard Job schema.
 * @param {Element} jobItem
 * @returns {import('./_types.js').Job}
 */
export function normalize(jobItem) {
  const title = getTextContent(jobItem, 'title');
  const url = getTextContent(jobItem, 'link');
  const description = getTextContent(jobItem, 'description');
  const postedDateRaw = getTextContent(jobItem, 'pubDate');
  const postedAt = postedDateRaw ? Date.parse(postedDateRaw) : undefined;

  // Glassdoor RSS doesn't always provide explicit company/location tags at the item level.
  const company = null;
  const location = null;

  return {
    title: title || '',
    company,
    location,
    url: url || '',
    description: description || '',
    postedAt: Number.isNaN(postedAt) ? undefined : postedAt,
  };
}

/**
 * Detect Glassdoor URLs.
 * @param {string|import('./_types.js').PortalEntry} entry
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  if (url.includes('glassdoor.com/Job')) {
    return { url: GLASSDOOR_RSS_URL };
  }
  return null;
}

/** @type {Provider} */
export default {
  id: 'glassdoor',

  detect,

  /**
   * Fetches and normalizes postings from the Glassdoor RSS feed.
   * @param {{ careers_url?: string }} entry
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx
   * @returns {Promise<Array<import('./_types.js').Job>>}
   */
  async fetch(entry, ctx) {
    const rssUrl = assertGlassdoorUrl(entry.careers_url || GLASSDOOR_RSS_URL);
    // redirect:'error' prevents SSRF via server-side redirects
    const response = await ctx.fetchJson(rssUrl, { redirect: 'error' });
    const xmlText = await response.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = Array.from(xmlDoc.getElementsByTagName('item'));

    return items.map(normalize).filter(j => j.title && j.url);
  },

  normalize,

  rateLimit: {
    requests: 60,
    window: '1min',
  },
};
