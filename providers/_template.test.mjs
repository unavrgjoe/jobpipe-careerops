/**
 * providers/_template.test.mjs — Basic tests for template provider.
 *
 * Run: node --test providers/_template.test.mjs
 */

import template from './_template.mjs';

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
// Template provider structure
// ============================================================================

console.log('\n--- Template provider structure ---');

ok('template has id field', template.id === 'template');
ok('template has detect method', typeof template.detect === 'function');
ok('template has fetch method', typeof template.fetch === 'function');

// ============================================================================
// detect() behavior
// ============================================================================

console.log('\n--- detect() behavior ---');

const entry = { name: 'TestCompany', careers_url: 'https://example.com/jobs' };
const result = template.detect(entry);

ok('detect returns null by default', result === null);
eq('detect result is null', result, null);

// ============================================================================
// fetch() behavior (no API URL)
// ============================================================================

console.log('\n--- fetch() behavior (no API URL) ---');

const ctx = {
  fetchJson: async (url) => ({ jobs: [] }),
};

try {
  const jobs = await template.fetch(entry, ctx);
  ok('fetch returns array', Array.isArray(jobs));
  eq('fetch returns empty array', jobs.length, 0);
} catch (e) {
  ok('fetch throws on missing API URL', e.message.includes('cannot derive API URL'));
}

// ============================================================================
// fetch() behavior (with API URL)
// ============================================================================

console.log('\n--- fetch() behavior (with API URL) ---');

const entryWithApi = {
  name: 'TestCompany',
  api: 'https://api.example.com/jobs',
};

try {
  const jobs = await template.fetch(entryWithApi, ctx);
  ok('fetch returns array', Array.isArray(jobs));
  eq('fetch returns empty array', jobs.length, 0);
} catch (e) {
  ok('fetch throws on missing API URL', e.message.includes('cannot derive API URL'));
}

// ============================================================================
// fetch() behavior (with mock data)
// ============================================================================

console.log('\n--- fetch() behavior (with mock data) ---');

// Template is minimal boilerplate — resolveApiUrl returns null by default
// Test that it throws a clear error message
const ctxWithMock = {
  fetchJson: async (url) => ({ jobs: [] }),
};

const entryWithUrl = {
  name: 'TestCompany',
  careers_url: 'https://jobs.example.com/testboard',
};

try {
  await template.fetch(entryWithUrl, ctxWithMock);
  ok('fetch throws on missing API URL implementation', false);
  failures.push('fetch should throw error when resolveApiUrl returns null');
} catch (e) {
  ok('fetch throws on missing API URL', true);
  eq('error message is clear', e.message, 'template: cannot derive API URL for TestCompany');
}

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
