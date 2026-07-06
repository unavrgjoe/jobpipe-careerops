# JobPipe Porting Plan

**Status**: Draft
**Owner**: unspecified-high (team-discovery-porting-plan)
**Target**: Align career-ops scan.mjs + portals.yml with JobsPipe inventory

---

## Executive Summary

This plan bridges the gap between Career-Ops' manual scanning architecture and JobsPipe's unified API approach. The goal is to add missing job board providers, unify parallelization, improve dedup/freshness, and provide a polished CLI without breaking existing workflows.

**Key Difference**: Career-Ops = 40+ unique sources with manual control (rate limits, dedup, verification). JobsPipe = 30+ sources with API-level abstraction. We're not replacing Career-Ops—we're extending it to match JobsPipe's breadth.

---

## Phase 1 - Add Missing Board Providers (1 week)

### Objective
Add 20+ job board providers to `portals.yml` that JobsPipe covers but Career-Ops lacks.

### Scope
- **JobsAPI**: Indeed-like aggregator (use existing jobs-api provider)
- **LinkedIn GraphQL**: Public job search endpoint
- **Glassdoor RSS**: RSS feed parsing
- **Specialized boards**: Wellfound, Otta, Hired, YC Jobs, RemoteOK, etc.

### Implementation
```yaml
# portals.yml
job_boards:
  - name: JobsAPI
    provider: jobsapi
    enabled: true

  - name: LinkedIn
    provider: linkedin
    enabled: true

  - name: Glassdoor
    provider: glassdoor
    enabled: true

  - name: Wellfound (AngelList)
    provider: wellfound
    enabled: true

  - name: Otta
    provider: otta
    enabled: true

  - name: Hired
    provider: hired
    enabled: true
```

### Deliverables
- [ ] 20+ provider implementations in `providers/*.mjs`
- [ ] Additions to `portals.yml` `job_boards` array
- [ ] Provider auto-detection tests in `validate-portals.mjs`

### Risks
- **Board API changes**: Provider version pinning in `portals.yml` (e.g., `linkedin:version: "2024-01"`)
- **Rate limits**: LinkedIn's public endpoint has strict limits → implement shared token bucket

---

## Phase 2 - Unify Parallel Worker (1 week)

### Objective
Merge JobsPipe's worker pool into scan.mjs. Single `scan.mjs --parallel N` flag controls both company ATS + board aggregators.

### Scope
- Replace fixed `CONCURRENCY = 10` with configurable `--parallel N`
- Shared rate-limit token bucket for all providers
- Provider-level rate-limit configs in `portals.yml`

### Implementation
```javascript
// scan.mjs
const PARALLEL_DEFAULT = 10;

async function parallelFetch(tasks, limit) {
  const results = [];
  const tokenBucket = createTokenBucket({
    rate: config.rate_limit || '100/min', // per-provider
    capacity: limit
  });

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      await tokenBucket.acquire();
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}
```

### Deliverables
- [ ] `--parallel N` flag in scan.mjs
- [ ] Token bucket implementation in providers/_http.mjs
- [ ] Provider rate-limit configs in `portals.yml`
- [ ] Performance benchmarks (parallel vs sequential)

### Risks
- **Rate limit collisions**: Shared bucket may starve slow providers → provider-specific buckets
- **Complexity**: Increased error handling for parallel failures → wrap in try/catch per task

---

## Phase 3 - Content Dedup + Freshness (1 week)

### Objective
Improve dedup accuracy and add freshness tracking for all sources.

### Scope
- **Content-hash column** in `scan-history.tsv` (sha256 of job description)
- **Dual-key dedup**: URL OR (company + title + location + postedDate)
- **Freshness parsing**: `postedDate` from board APIs, fallback to check-liveness.mjs

### Implementation
```javascript
// scan.mjs
function createContentHash(description) {
  return crypto.createHash('sha256').update(description || '').digest('hex');
}

export function loadSeenUrls(policy = {}) {
  const seen = new Set();
  const seenContent = new Map(); // url -> contentHash

  // Load scan-history.tsv
  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) {
      const [url, firstSeen, , , , status = 'added', location] = line.split('\t');
      if (!url) continue;

      // URL-based dedup (permanent)
      if (PERMANENT_SCAN_HISTORY_STATUSES.has(status)) {
        seen.add(url);
        continue;
      }

      // Content-based dedup for boards without stable URLs
      const contentHash = createContentHash(location); // location contains description in TSV
      if (seenContent.has(contentHash)) {
        continue; // Skip duplicate content
      }
      seenContent.set(contentHash, url);
    }
  }

  return { seen, seenContent };
}
```

### Deliverables
- [ ] Content-hash column added to `scan-history.tsv`
- [ ] Dual-key dedup logic in `loadSeenUrls()`
- [ ] `postedDate` field parsing in providers/*.mjs
- [ ] Freshness tracking in `data/scan-history.tsv`

### Risks
- **Dedup false positives**: Same role posted on multiple boards → content-hash matches, but should keep all
  - **Mitigation**: Content-hash only for boards without stable URLs (job_boards). ATS URLs always use URL dedup.
- **Missing descriptions**: Some boards don't return descriptions → fallback to URL-only dedup

---

## Phase 4 - CLI Polish + Docs (3 days)

### Objective
Provide a unified `/career-ops scan` experience with source filtering.

### Scope
- Single `/career-ops scan` auto-detects all sources (companies + boards)
- `--source=company|board|all` filter
- Documentation in `AGENTS.md` and new `docs/porting-plan.md`

### Implementation
```yaml
# portals.yml
scan:
  auto_detect: true
  default_sources:
    - company
    - board
  filters:
    - source: company|board
```

```markdown
# AGENTS.md - New section
## Scan Mode

Run `/career-ops scan` to discover new offers across all configured sources.

### Source Types
- **company**: Tracked companies with careers_url (Greenhouse, Ashby, Lever, etc.)
- **board**: Job board aggregators (Indeed, LinkedIn, Glassdoor, etc.)
- **all**: Both companies and boards (default)

### Flags
- `--parallel N`: Number of concurrent fetches (default: 10)
- `--source TYPE`: Filter by source type (company|board|all)
- `--throttle MS`: Jittered delay between requests (default: 5000ms)
- `--verify`: Playwright liveness check for new offers

### Examples
```bash
/career-ops scan --parallel 20 --source all
/career-ops scan --source company --company Anthropic
/career-ops scan --source board --board LinkedIn
```
```

### Deliverables
- [ ] Unified `/career-ops scan` command
- [ ] `--source` filter implementation
- [ ] Updated `AGENTS.md` with scan mode docs
- [ ] New `docs/porting-plan.md` (this file)

### Risks
- **Config bloat**: Too many options → group under `scan` namespace in `portals.yml`
- **User confusion**: `--source` vs `--company` overlap → clear CLI help text

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Board API changes** | High | Medium | Provider version pinning in `portals.yml` (e.g., `linkedin:version: "2024-01"`) |
| **Rate limit collisions** | High | Medium | Shared token bucket with exponential backoff; provider-specific buckets for slow sources |
| **Dedup false positives** | Medium | Low | Content-hash + URL dual-key; content-hash only for boards without stable URLs |
| **Config bloat** | Low | Medium | portals.yml stays single source of truth; boards in `job_boards` array; group scan options under `scan` namespace |
| **Performance regression** | Medium | Low | Parallelization benchmarks before/after; fallback to sequential for problematic providers |

---

## Rollback Strategy

Each phase is independent and can be reverted individually:

### Git Workflow
```bash
git checkout -b feature/porting-plan
# Implement Phase 1
git commit -m "Add missing board providers (Phase 1)"
# Merge to main when stable
git checkout main
git merge feature/porting-plan

# To revert Phase 1:
git revert <commit-hash>
```

### Feature Flags
```bash
# Enable new features in parallel with existing code
SCAN_V2=1 node scan.mjs --parallel 20
```

### Rollback Checklist
- [ ] Verify existing scans still work (`node scan.mjs --dry-run`)
- [ ] Test dedup logic with existing `scan-history.tsv`
- [ ] Run `npm run verify-pipeline` to ensure integrity
- [ ] Document rollback steps in `docs/ROLLBACK.md`

---

## Success Metrics

| Metric | Target | Current | After Phase 4 |
|--------|--------|---------|---------------|
| **Sources covered** | 50+ | 40+ | 50+ |
| **Parallel workers** | Configurable (default 10) | Fixed (10) | Configurable |
| **Dedup accuracy** | 95%+ | ~80% | 95%+ |
| **Freshness tracking** | postedDate field | None | postedDate + expires_at |
| **CLI sources** | 3 types (company/board/all) | 1 type (company) | 3 types |

---

## Next Steps

1. **Approve plan**: Lead confirms phases and risk register
2. **Phase 1 kickoff**: Implement missing board providers
3. **Parallel worker integration**: Merge JobsPipe's worker pool
4. **Dedup/freshness**: Add content-hash and freshness tracking
5. **CLI polish**: Unify `/career-ops scan` with source filtering
6. **Documentation**: Update AGENTS.md and create porting-plan.md

---

**Document Version**: 1.0
**Last Updated**: 2026-07-04
**Owner**: unspecified-high (team-discovery-porting-plan)
