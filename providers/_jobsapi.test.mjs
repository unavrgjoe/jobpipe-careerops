/**
 * providers/jobsapi.test.mjs — Tests for JobsAPI provider.
 *
 * Run: node --test providers/jobsapi.test.mjs
 */

import jobsapi from './jobsapi.mjs';

let passed = 0;
let failed = 0;
const failures = [];

function ok(label, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}

function eq(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL: ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ============================================================================
// Provider structure
// ============================================================================

console.log('\n--- JobsAPI provider structure ---');

ok('jobsapi has id field', jobsapi.id === 'jobsapi');
ok('jobsapi has detect method', typeof jobsapi.detect === 'function');
ok('jobsapi has fetch method', typeof jobsapi.fetch === 'function');
ok('jobsapi has normalize method', typeof jobsapi.normalize === 'function');

// ============================================================================
// detect() behavior
// ============================================================================

console.log('\n--- detect() behavior ---');

const entry = { name: 'TestCompany', careers_url: 'https://jobsapi.com/jobs' };
const result = jobsapi.detect(entry);

ok('detect returns { url } for jobsapi.com', result !== null);
eq('detect url matches input', result.url, 'https://jobsapi.com/jobs');

const indeedEntry = { name: 'IndeedTest', careers_url: 'https://indeed.com/jobs/search?q=engineer' };
const indeedResult = jobsapi.detect(indeedEntry);

ok('detect returns { url } for indeed.com', indeedResult !== null);
eq('detect url matches indeed input', indeedResult.url, 'https://indeed.com/jobs/search?q=engineer');

const notMatch = jobsapi.detect({ name: 'Other', careers_url: 'https://example.com/jobs' });
ok('detect returns null for non-matching URL', notMatch === null);

// ============================================================================
// normalize() behavior
// ============================================================================

console.log('\n--- normalize() behavior ---');

const testJob = {
  title: 'Software Engineer',
  url: 'https://jobsapi.com/job/123',
  companyName: 'Test Corp',
  location: 'Remote',
  description: 'Test job description',
  postedDate: '2024-01-15T00:00:00Z',
};

const normalized = jobsapi.normalize(testJob, 'https://jobsapi.com');

eq('normalize title', normalized.title, 'Software Engineer');
eq('normalize url', normalized.url, 'https://jobsapi.com/job/123');
eq('normalize company', normalized.company, 'Test Corp');
eq('normalize location', normalized.location, 'Remote');
eq('normalize description', normalized.description, 'Test job description');
ok('normalize postedAt is epoch ms', normalized.postedAt !== undefined && !Number.isNaN(normalized.postedAt));
eq('normalize source', normalized.source, 'JobsAPI');

// Test with missing fields
const minimalJob = { title: 'Minimal Job' };
const minimalNormalized = jobsapi.normalize(minimalJob, 'https://jobsapi.com');
eq('normalize handles missing fields', minimalNormalized.title, 'Minimal Job');
eq('normalize company is empty string', minimalNormalized.company, '');
ok('normalize url is empty string', minimalNormalized.url === '');

// ============================================================================
// rateLimit behavior
// ============================================================================

console.log('\n--- rateLimit behavior ---');

const rateLimit = jobsapi.rateLimit;
ok('rateLimit is defined', rateLimit !== undefined);
eq('rateLimit requests', rateLimit.requests, 30);
eq('rateLimit window', rateLimit.window, '1min');

// ============================================================================
// Results
// ============================================================================

console.log(`\n${'='.repeat(78)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\n  Failed tests:`);
  for (const f of failures) console.log(`    - ${f}`);
}
console.log(`${'='.repeat(78)}`);

process.exit(failed > 0 ? 1 : 0);
