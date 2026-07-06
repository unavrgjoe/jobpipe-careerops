#!/usr/bin/env node

/**
 * verify-e2e.mjs — End-to-end verification script for scan.mjs
 * 
 * Tests the complete scan pipeline:
 * 1. Default scan (all sources)
 * 2. Company-only scan
 * 3. Board-only scan
 * 4. Fresh-only filter
 * 3. Parallel workers
 * 6. Source filter combinations
 * 7. Dry-run doesn't write files
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const TEST_DIR = 'tests/fixtures';
const SCAN_HISTORY_PATH = 'data/scan-history.tsv';
const PIPELINE_PATH = 'data/pipeline.md';

async function runTests() {
  console.log('=== End-to-End Verification Tests ===\n');
  
  let passed = 0;
  let failed = 0;
  
  // Backup original files
  const originalScanHistory = existsSync(SCAN_HISTORY_PATH) ? readFileSync(SCAN_HISTORY_PATH, 'utf-8') : null;
  const originalPipeline = existsSync(PIPELINE_PATH) ? readFileSync(PIPELINE_PATH, 'utf-8') : null;
  
  try {
    // Test 1: Default scan --dry-run
    console.log('Test 1: Default scan --dry-run');
    const result1 = runScan(['--dry-run']);
    if (result1.stdout.includes('New offers added:') && result1.status === 0) {
      console.log('  ✅ PASS: Default scan runs and reports new offers');
      passed++;
    } else {
      console.log('  ❌ FAIL: Default scan failed');
      console.log(`     stdout: ${result1.stdout.slice(0, 200)}`);
      console.log(`     stderr: ${result1.stderr.slice(0, 200)}`);
      failed++;
    }
    
    // Test 2: --source=company
    console.log('\nTest 2: --source=company filter');
    const result2 = runScan(['--source=company', '--dry-run']);
    if (result2.stdout.includes('companies') && !result2.stdout.includes('job boards') && result2.status === 0) {
      console.log('  ✅ PASS: Company-only scan works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Company-only scan failed');
      console.log(`     stdout: ${result2.stdout.slice(0, 200)}`);
      failed++;
    }
    
    // Test 3: --source=board
    console.log('\nTest 3: --source=board filter');
    const result3 = runScan(['--source=board', '--dry-run']);
    if (result3.stdout.includes('17 job boards') && result3.stdout.includes('0 companies') && result3.status === 0) {
      console.log('  ✅ PASS: Board-only scan works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Board-only scan failed');
      console.log(`     stdout: ${result3.stdout.slice(0, 200)}`);
      failed++;
    }
    
    // Test 4: --source=all
    console.log('\nTest 4: --source=all filter');
    const result4 = runScan(['--source=all', '--dry-run']);
    if (result4.stdout.includes('companies') && result4.stdout.includes('job boards') && result4.status === 0) {
      console.log('  ✅ PASS: All sources scan works');
      passed++;
    } else {
      console.log('  ❌ FAIL: All sources scan failed');
      console.log(`     stdout: ${result4.stdout.slice(0, 200)}`);
      failed++;
    }
    
    // Test 5: --fresh-only
    console.log('\nTest 5: --fresh-only filter');
    const result5 = runScan(['--fresh-only', '--dry-run']);
    if (result5.status === 0) {
      console.log('  ✅ PASS: Fresh-only filter works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Fresh-only filter failed');
      failed++;
    }
    
    // Test 6: --fresh-only=14
    console.log('\nTest 6: --fresh-only=14 custom window');
    const result6 = runScan(['--fresh-only=14', '--dry-run']);
    if (result6.status === 0) {
      console.log('  ✅ PASS: Custom freshness window works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Custom freshness window failed');
      failed++;
    }
    
    // Test 7: --parallel N
    console.log('\nTest 7: --parallel 5');
    const result7 = runScan(['--parallel=5', '--dry-run']);
    if (result7.status === 0) {
      console.log('  ✅ PASS: Parallel workers flag works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Parallel workers failed');
      failed++;
    }
    
    // Test 8: --company filter
    console.log('\nTest 8: --company anthropic');
    const result8 = runScan(['--company=anthropic', '--dry-run']);
    if (result8.status === 0) {
      console.log('  ✅ PASS: Company filter works');
      passed++;
    } else {
      console.log('  ❌ FAIL: Company filter failed');
      failed++;
    }
    
    // Test 9: Dry-run doesn't write files
    console.log('\nTest 9: --dry-run does not modify files');
    const scanHistoryBefore = existsSync(SCAN_HISTORY_PATH) ? readFileSync(SCAN_HISTORY_PATH, 'utf-8') : '';
    const pipelineBefore = existsSync(PIPELINE_PATH) ? readFileSync(PIPELINE_PATH, 'utf-8') : '';
    runScan(['--dry-run']);
    const scanHistoryAfter = existsSync(SCAN_HISTORY_PATH) ? readFileSync(SCAN_HISTORY_PATH, 'utf-8') : '';
    const pipelineAfter = existsSync(PIPELINE_PATH) ? readFileSync(PIPELINE_PATH, 'utf-8') : '';
    if (scanHistoryBefore === scanHistoryAfter && pipelineBefore === pipelineAfter) {
      console.log('  ✅ PASS: Dry-run preserves files');
      passed++;
    } else {
      console.log('  ❌ FAIL: Dry-run modified files');
      failed++;
    }
    
    // Test 10: Combined flags
    console.log('\nTest 10: Combined flags (--source=board --fresh-only --parallel=3)');
    const result10 = runScan(['--source=board', '--fresh-only', '--parallel=3', '--dry-run']);
    if (result10.status === 0) {
      console.log('  ✅ PASS: Combined flags work');
      passed++;
    } else {
      console.log('  ❌ FAIL: Combined flags failed');
      failed++;
    }
    
  } finally {
    // Restore original files
    if (originalScanHistory) {
      writeFileSync(SCAN_HISTORY_PATH, originalScanHistory);
    } else if (existsSync(SCAN_HISTORY_PATH)) {
      unlinkSync(SCAN_HISTORY_PATH);
    }
    if (originalPipeline) {
      writeFileSync(PIPELINE_PATH, originalPipeline);
    } else if (existsSync(PIPELINE_PATH)) {
      unlinkSync(PIPELINE_PATH);
    }
  }
  
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

function runScan(args) {
  const result = spawnSync('node', ['scan.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 60000, // Reduced timeout
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});