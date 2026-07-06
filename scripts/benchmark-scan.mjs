#!/usr/bin/env node

/**
 * benchmark-scan.mjs — Performance benchmark for scan.mjs with different parallel levels.
 * 
 * Runs scan.mjs --dry-run with various --parallel values and measures:
 * - Total execution time
 * - Offers found
 * - Memory usage
 * - Rate limit errors (if any)
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

const PARALLEL_LEVELS = [1, 5, 10, 20, 50];
const RUNS_PER_LEVEL = 1; // Can increase for more statistical significance

async function runScan(parallel) {
  return new Promise((resolve) => {
    const start = performance.now();
    let stdout = '';
    let stderr = '';
    
    const child = spawn('node', ['scan.mjs', '--parallel', String(parallel), '--dry-run'], {
      cwd: process.cwd(),
    });
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const end = performance.now();
      const durationMs = end - start;
      
      // Parse output for metrics
      const jobsFoundMatch = stdout.match(/Total jobs found:\s+(\d+)/);
      const newOffersMatch = stdout.match(/New offers added:\s+(\d+)/);
      const companiesScannedMatch = stdout.match(/Companies scanned:\s+(\d+)/);
      const jobBoardsScannedMatch = stdout.match(/Job boards scanned:\s+(\d+)/);
      
      const memUsage = process.memoryUsage();
      
      resolve({
        parallel,
        durationMs: Math.round(durationMs),
        exitCode: code,
        jobsFound: jobsFoundMatch ? parseInt(jobsFoundMatch[1], 10) : 0,
        newOffers: newOffersMatch ? parseInt(newOffersMatch[1], 10) : 0,
        companiesScanned: companiesScannedMatch ? parseInt(companiesScannedMatch[1], 10) : 0,
        jobBoardsScanned: jobBoardsScannedMatch ? parseInt(jobBoardsScannedMatch[1], 10) : 0,
        memoryMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        stderr: stderr.slice(0, 500),
      });
    });
    
    child.on('error', (err) => {
      resolve({
        parallel,
        durationMs: 0,
        exitCode: -1,
        error: err.message,
        jobsFound: 0,
        newOffers: 0,
        companiesScanned: 0,
        jobBoardsScanned: 0,
        memoryMb: 0,
      });
    });
  });
}

async function main() {
  console.log('=== Career-Ops Scan Benchmark ===\n');
  console.log(`Testing parallel levels: ${PARALLEL_LEVELS.join(', ')}\n`);
  
  const results = [];
  
  for (const parallel of PARALLEL_LEVELS) {
    console.log(`Running with --parallel ${parallel}...`);
    const result = await runScan(parallel);
    results.push(result);
    
    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
    } else if (result.exitCode !== 0) {
      console.log(`  ⚠️  Exit code: ${result.exitCode}`);
    } else {
      console.log(`  ✅ ${result.durationMs}ms | Jobs: ${result.jobsFound} | New: ${result.newOffers} | Mem: ${result.memoryMb}MB`);
    }
  }
  
  // Print summary table
  console.log('\n=== Benchmark Results ===\n');
  console.log('| Parallel | Time (ms) | Jobs Found | New Offers | Companies | Boards | Memory (MB) |');
  console.log('|----------|-----------|------------|------------|-----------|--------|-------------|');
  
  for (const r of results) {
    const time = r.error || r.exitCode !== 0 ? 'ERROR' : `${r.durationMs}ms`;
    console.log(`| ${r.parallel.toString().padStart(8)} | ${time.padStart(9)} | ${r.jobsFound.toString().padStart(10)} | ${r.newOffers.toString().padStart(10)} | ${r.companiesScanned.toString().padStart(9)} | ${r.jobBoardsScanned.toString().padStart(6)} | ${r.memoryMb.toString().padStart(11)} |`);
  }
  
  // Calculate speedup
  console.log('\n=== Speedup Analysis ===\n');
  const baseline = results.find(r => r.parallel === 1);
  if (baseline && !baseline.error) {
    for (const r of results) {
      if (r.parallel !== 1 && !r.error) {
        const speedup = (baseline.durationMs / r.durationMs).toFixed(2);
        console.log(`--parallel ${r.parallel}: ${speedup}x speedup vs baseline`);
      }
    }
  }
  
  // Output JSON for CI/CD
  console.log('\n=== JSON Output ===\n');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);