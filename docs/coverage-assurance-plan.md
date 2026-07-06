# Coverage Assurance Plan: Aggregate-Site Crawlers & ATS Points

## Objective
Ensure zero regression and complete coverage of all job sources from both career-ops and JobsPipe, including:
- All existing ATS providers (Greenhouse, Ashby, Lever, Workable, SmartRecruiters, etc.)
- All job board aggregators (Indeed, LinkedIn, Glassdoor, Wellfound, Otta, Hired, YC Jobs, RemoteOK, etc.)
- Crawler-only sites (no public API)
- Proper handling of all existing tracked_companies

## Current Coverage Analysis

### career-ops (existing)
| Category | Count | Details |
|----------|-------|---------|
| Tracked Companies (ATS) | 85 | Auto-detected via providers/*.mjs |
| Job Boards | 1 | SolidJobs Poland |
| Search Queries | 200+ | WebSearch-based discovery |
| ATS Providers | 12+ | greenhouse, ashby, lever, workable, smartrecruiters, recruitee, bamboohr, breezy, solidjobs, comeet, personio, pinpoint, rippling, jibeapply |

### JobsPipe (target)
| Category | Count | Details |
|----------|-------|---------|
| Sources | 30+ | Unified API abstraction |
| Board Aggregators | 20+ | Indeed, LinkedIn, Glassdoor, Wellfound, Otta, Hired, YC Jobs, RemoteOK, WeWorkRemotely, WorkingNomads, Himalayas, 4DayWeek, JobsAPI, Remotive, EU Remote Jobs, Jobicy, Landing.jobs, JustJoin.it, NoFluffJobs, etc. |

### Gap to Close
- **20+ board providers** (Wave 2, Tasks 4-22)
- **Crawler support** for sites without APIs (Playwright-based)
- **Validation** that all 85 tracked_companies still work
- **Dedup** across ATS + board sources

## Assurance Strategy

### 1. ATS Provider Completeness Check
```bash
# Verify all existing providers still load
node -e "import { loadProviderIds } from './validate-portals.mjs'; const ids = await loadProviderIds(); console.log([...ids].sort().join('\n'))"
```

### 2. Crawler Inventory
| Source Type | Detection Method | Current Status |
|-------------|------------------|----------------|
| Greenhouse | API (`boards-api.greenhouse.io`) | ✅ Provider exists |
| Ashby | API (`jobs.ashbyhq.com`) | ✅ Provider exists |
| Lever | API (`jobs.lever.co`) | ✅ Provider exists |
| Workable | API (`apply.workable.com`) | ✅ Provider exists |
| SmartRecruiters | API (`careers.smartrecruiters.com`) | ✅ Provider exists |
| Recruitee | API (`*.recruitee.com`) | ✅ Provider exists |
| BambooHR | API (`*.bamboohr.com`) | ✅ Provider exists |
| Breezy | API (`*.breezy.hr`) | ✅ Provider exists |
| Comeet | API (requires token) | ✅ Provider exists |
| Personio | API (`*.jobs.personio.de`) | ✅ Provider exists |
| Pinpoint | API (`*.pinpointhq.com`) | ✅ Provider exists |
| Rippling | API (`ats.rippling.com`) | ✅ Provider exists |
| JibeApply | API (`*.jibeapply.com`) | ✅ Provider exists |
| **Crawler-only sites** | Playwright | ❌ Need implementation |

### 3. Board Provider Implementation Checklist (Wave 2)
For each of 20+ providers:
- [ ] `detect()` - URL pattern matching
- [ ] `fetch()` - API or crawler (Playwright fallback)
- [ ] `normalize()` - standard job schema
- [ ] `rateLimit` - conservative config
- [ ] Tests with mocked responses
- [ ] Added to `portals.yml` job_boards
- [ ] `node validate-portals.mjs` passes
- [ ] `node scan.mjs --dry-run --source board` includes it

### 4. Regression Test Suite
```bash
# Pre-Wave 2 baseline
node scan.mjs --dry-run > baseline.txt

# Post each provider
node scan.mjs --dry-run --source company > company_only.txt
node scan.mjs --dry-run --source board > board_only.txt
node scan.mjs --dry-run --source all > all_sources.txt

# Verify counts
# Companies scanned: ≥85 (no regression)
# Job boards scanned: ≥20 (new)
```

### 5. Crawler Sites Requiring Playwright
Sites with no public API that need Playwright-based crawlers:
- Company career pages without ATS (custom SSR)
- Some European boards (Welcome to the Jungle, JobTeaser)
- Startup job boards (AngelList/Wellfound - though API exists)
- University career centers
- Government job portals

## Review Request

Two subagents should review this plan for:
1. **Completeness** - Are any ATS providers or board aggregators missing?
2. **Correctness** - Will the validation approach catch regressions?
3. **Feasibility** - Is the crawler strategy sound?

## Next Steps After Review
1. Incorporate feedback
2. Launch Wave 2 (20 board providers) in MAX PARALLEL
3. Run regression checks after each provider
4. Proceed to Wave 3 (unified parallel worker)