#!/usr/bin/env node
/**
 * migrate-scan-history.mjs — Migrate scan-history.tsv to 9-column format
 *
 * Old format (7 columns): url, first_seen, portal, title, company, status, location
 * New format (9 columns): url, first_seen, portal, title, company, status, content_hash, posted_date, expires_at
 *
 * Migration adds:
 * - content_hash: SHA256 hash of description (empty for existing rows)
 * - posted_date: same as first_seen (date of first discovery)
 * - expires_at: first_seen + 30 days
 *
 * Run: node scripts/migrate-scan-history.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_HISTORY_PATH = join(__dirname, '..', 'data', 'scan-history.tsv');
const DRY_RUN = process.argv.includes('--dry-run');

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createContentHash(description = '') {
  if (!description || description.trim() === '') return '';
  return createHash('sha256').update(description.trim()).digest('hex');
}

function normalizeScanScalar(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeScanUrl(value) {
  return String(value ?? '').trim().split(/\s+/)[0] || '';
}

function sanitizeTsvField(value) {
  const normalized = normalizeScanScalar(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function formatScanHistoryRow(cols) {
  // Handle both 6-col (url, first_seen, portal, title, company, status) and 7-col (with location)
  const [url, firstSeen, portal, title, company, status, location] = cols.map(sanitizeTsvField);
  return [
    normalizeScanUrl(url),
    firstSeen,
    portal,
    title,
    company,
    status,
    '', // content_hash (empty for migrated rows)
    firstSeen, // posted_date (same as first_seen)
    addDays(firstSeen, 30), // expires_at
  ].map(sanitizeTsvField).join('\t');
}

async function migrate() {
  if (!existsSync(SCAN_HISTORY_PATH)) {
    console.log('✓ No scan-history.tsv found — nothing to migrate');
    return;
  }

  const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
  const header = lines[0];
  const colCount = header ? header.split('\t').length : 0;

  // Check if already migrated
  if (colCount === 9) {
    console.log('✓ scan-history.tsv already has 9 columns — no migration needed');
    return;
  }

  if (colCount !== 6 && colCount !== 7) {
    console.error(`✗ Unexpected column count: ${colCount}. Expected 6 (old without location) or 7 (old with location) or 9 (new).`);
    process.exit(1);
  }

  console.log(`Migrating ${lines.length - 1} rows from 7-column to 9-column format...`);

  const newLines = [header];
  let migratedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t');
    newLines.push(formatScanHistoryRow(cols));
    migratedCount++;
  }

  if (migratedCount > 0) {
    if (DRY_RUN) {
      console.log(`\n[Dry run] Would write ${migratedCount} rows`);
      console.log('\nNew header:');
      console.log(newLines[0]);
      console.log('\nFirst few rows:');
      newLines.slice(1, 4).forEach(line => console.log(line));
    } else {
      writeFileSync(SCAN_HISTORY_PATH, newLines.join('\n'), 'utf-8');
      console.log(`✓ Migrated ${migratedCount} rows to 9-column format`);
    }
  } else {
    console.log('✓ No data rows to migrate');
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
