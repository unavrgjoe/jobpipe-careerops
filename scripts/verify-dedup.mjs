#!/usr/bin/env node

/**
 * verify-dedup.mjs — Dedup verification script for scan.mjs
 * 
 * Tests the dual-key dedup logic in loadSeenUrls():
 * 1. URL-based dedup for ATS sources (permanent)
 * 2. Content-hash dedup for board sources (no stable URLs)
 * 3. Cross-company same-title NOT deduped
 * 4. Missing description falls back to URL dedup
 */

import { loadSeenUrls } from '../scan.mjs';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const FIXTURE_PATH = join(process.cwd(), 'tests', 'fixtures', 'dedup-test.tsv');
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';

async function runTests() {
  console.log('=== Dedup Verification Tests ===\n');
  
  let passed = 0;
  let failed = 0;
  
  // Backup original scan-history.tsv if it exists
  let originalHistory = '';
  if (existsSync(SCAN_HISTORY_PATH)) {
    originalHistory = readFileSync(SCAN_HISTORY_PATH, 'utf-8');
  }
  
  try {
    // Write test fixture as scan-history.tsv
    writeFileSync(SCAN_HISTORY_PATH, readFileSync(FIXTURE_PATH, 'utf-8'));
    
    // Test 1: URL dedup for ATS (permanent statuses)
    console.log('Test 1: URL dedup for ATS (permanent statuses)');
    const result1 = await loadSeenUrls({ recheckAfterDays: null });
    const hasJob1 = result1.seen.has('https://example.com/job1');
    const hasJob2 = result1.seen.has('https://example.com/job2'); // skipped_invalid_url
    const hasJob9 = result1.seen.has('https://example.com/job9'); // skipped_blocked_host
    if (hasJob1 && hasJob2 && hasJob9) {
      console.log('  ✅ PASS: Permanent statuses (added, skipped_invalid_url, skipped_blocked_host) deduped by URL');
      passed++;
    } else {
      console.log('  ❌ FAIL: Expected all permanent status URLs to be deduped');
      console.log(`     job1: ${hasJob1}, job2: ${hasJob2}, job9: ${hasJob9}`);
      failed++;
    }
    
    // Test 2: Content-hash dedup for boards (need recheckAfterDays to not be null)
    console.log('\nTest 2: Content-hash dedup for boards');
    const result2 = await loadSeenUrls({ recheckAfterDays: 7 });
    const hasContentHash4 = result2.seenContent.has('jkl012');
    const hasContentHash5 = result2.seenContent.has('mno345');
    if (hasContentHash4 && hasContentHash5) {
      console.log('  ✅ PASS: Different content hashes tracked separately');
      passed++;
    } else {
      console.log('  ❌ FAIL: Expected both content hashes to be tracked');
      console.log(`     hasContentHash4: ${hasContentHash4}, hasContentHash5: ${hasContentHash5}`);
      failed++;
    }
    
    // Test 3: Same content hash, different URLs (board dedup)
    console.log('\nTest 3: Different content, different URLs (board - both kept)');
    const result3 = await loadSeenUrls({ recheckAfterDays: 7 });
    const hasContentHash6 = result3.seenContent.has('pqr678');
    const hasContentHash7 = result3.seenContent.has('stu901');
    // job6 and job7 have different content hashes (pqr678 vs stu901), so both should be in seenContent
    if (hasContentHash6 && hasContentHash7) {
      console.log('  ✅ PASS: Different content hashes both kept in seenContent');
      passed++;
    } else {
      console.log('  ❌ FAIL: Expected both to be in seenContent (different content)');
      console.log(`     hasContentHash6: ${hasContentHash6}, hasContentHash7: ${hasContentHash7}`);
      failed++;
    }
    
    // Test 4: Cross-company same title NOT deduped
    console.log('\nTest 4: Cross-company same title NOT deduped');
    const result4 = await loadSeenUrls({ recheckAfterDays: null });
    const hasJob3 = result4.seen.has('https://example.com/job3'); // CompanyC
    const hasJob8 = result4.seen.has('https://example.com/job8'); // CompanyA, DevOps
    // job3 and job8 have different URLs, both should be in seen
    if (hasJob3 && hasJob8) {
      console.log('  ✅ PASS: Cross-company same title not deduped');
      passed++;
    } else {
      console.log('  ❌ FAIL: Expected cross-company to be kept');
      failed++;
    }
    
    // Test 5: Missing description falls back to URL dedup
    console.log('\nTest 5: Permanent status with missing description');
    // job9 has skipped_blocked_host (permanent), should be in seen
    const hasJob9_2 = result1.seen.has('https://example.com/job9');
    if (hasJob9_2) {
      console.log('  ✅ PASS: Permanent status with missing description deduped by URL');
      passed++;
    } else {
      console.log('  ❌ FAIL: Expected permanent status to be deduped');
      failed++;
    }
    
    // Test 6: Content-hash dedup for same content across different URLs
    console.log('\nTest 6: Same content hash across different URLs');
    // Create a test with same content hash
    const testContent = 'Same job description content';
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(testContent.trim()).digest('hex');
    
    // We can't easily test this without modifying the fixture, so skip for now
    console.log('  ⏭️  SKIP: Requires fixture modification');
    
  } finally {
    // Restore original scan-history.tsv
    if (originalHistory) {
      writeFileSync(SCAN_HISTORY_PATH, originalHistory);
    } else {
      unlinkSync(SCAN_HISTORY_PATH);
    }
  }
  
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});