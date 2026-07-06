// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

import { fetchJson, fetchWithRetry } from './_http.mjs';

const JOBSAPI_RATE_LIMIT = 30; // requests per minute
const JOBSAPI_TIMEOUT_MS = 15_000;

/**
 * Detects jobsapi.com or Indeed-like job aggregator URLs.
 * @param {import('./_types.js').PortalEntry|string} entry - PortalEntry object or URL string
 * @returns {{ url: string } | null}
 */
export function detect(entry) {
  const url = typeof entry === 'string' ? entry : (entry.careers_url || '');
  const match = url.match(/(jobsapi\.com|indeed\.com)\/jobs(?:\/search)?(?:\?.*)?$/i);
  if (!match) return null;
  return { url };
}

/**
 * Normalizes job data to the standard schema.
 * @param {any} job - Raw job object from API response
 * @param {string} boardUrl - Base URL for the job board
 * @returns {import('./_types.js').Job}
 */
export function normalize(job, boardUrl) {
  return {
    title: job.title || '',
    url: job.url || job.jobUrl || '',
    company: job.companyName || job.employer || '',
    location: job.location || job.locationName || '',
    description: job.description || '',
    postedAt: toEpochMs(job.postedDate || job.datePosted || job.publishedAt),
    source: 'JobsAPI',
  };
}

/**
 * Fetches job listings from the JobsAPI (or Indeed-like) API.
 * @param {import('./_types.js').PortalEntry} entry
 * @param {import('./_types.js').Context} ctx
 * @returns {Promise<import('./_types.js').Job[]>}
 */
export async function fetch(entry, ctx) {
  const apiUrl = entry.api;
  if (!apiUrl) {
    throw new Error(`jobsapi: API URL not configured for ${entry.name}. Please add an 'api' field to your portals.yml entry.`);
  }

  const response = await fetchWithRetry(apiUrl, {
    timeoutMs: JOBSAPI_TIMEOUT_MS,
    maxRetries: 2,
  });
  const json = await response.json();

  const jobList = Array.isArray(json) ? json : (json.jobs || []);

  return jobList.map(job => normalize(job, apiUrl));
}

/** @type {Provider} */
export default {
  id: 'jobsapi',
  detect,
  fetch,
  normalize,
  rateLimit: {
    requests: JOBSAPI_RATE_LIMIT,
    window: '1min',
  },
};

function toEpochMs(value) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
