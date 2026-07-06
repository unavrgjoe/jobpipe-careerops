# Job Discovery Porting Plan: Career-Ops + JobsPipe Alignment

## TL;DR

> **Quick Summary**: Port 20+ missing job board providers from JobsPipe into career-ops, unify parallel worker pool, add content-hash dedup + freshness tracking, and polish CLI with source filtering — all while keeping career-ops's superior ATS scanning speed and verification.
>
> **Deliverables**:
> - 20+ new provider implementations in `providers/*.mjs` (LinkedIn, Glassdoor, Wellfound, Otta, Hired, YC Jobs, RemoteOK, etc.)
> - Unified `--parallel N` flag with token-bucket rate limiting in `scan.mjs`
> - Content-hash column in `scan-history.tsv` with dual-key dedup logic
> - `postedDate` parsing in all providers + freshness tracking
> - `/career-ops scan --source=company|board|all` CLI with docs in `AGENTS.md`
>
> **Estimated Effort**: Medium (3-4 weeks across 4 phases)
> **Parallel Execution**: YES — Phase 1 and 2 can run in parallel; Phase 3 depends on Phase 1; Phase 4 depends on all
> **Critical Path**: Phase 1 → Phase 3 → Phase 4; Phase 2 → Phase 4

---

## Context

### Original Request
Port JobsPipe's job board coverage (30+ sources) into career-ops without losing career-ops's strengths: parallel ATS scanning (85 companies → 100 offers/30s), Playwright verification, URL-based dedup, and single-config simplicity (`portals.yml`).

### Research Findings
- **career-ops scan.mjs**: 85 tracked companies + 1 job board, 100 new offers in ~30s dry-run, auto-detects providers via `providers/*.mjs`
- **JobsPipe**: Unified API abstraction over 30+ sources (Indeed, LinkedIn, Glassdoor, Wellfound, Otta, Hired, etc.)
- **Gap**: career-ops misses major board aggregators; has no content-hash dedup, no `postedDate` freshness, fixed concurrency
- **Porting Plan**: `docs/porting-plan.md` (advisory, 4 phases, risk register, rollback strategy)

### Key Architectural Decisions
1. **Keep `portals.yml` as single source of truth** — add `job_boards` array + `scan` namespace
2. **Providers stay in `providers/*.mjs`** — auto-detection via `detect()` pattern, add new board providers
3. **Phase 1 & 2 parallel** — board providers don't need unified worker; worker doesn't need new providers
4. **Dual-key dedup** — URL for ATS (permanent), content-hash for boards (no stable URLs)
5. **Feature flag `SCAN_V2=1`** — test new features alongside existing code

---

## Work Objectives

### Core Objective
Extend career-ops job discovery to match JobsPipe's source breadth (50+ sources) while preserving career-ops's speed, verification, and config simplicity.

### Concrete Deliverables
- [ ] 20+ board provider implementations in `providers/*.mjs`
- [ ] Updated `portals.yml` with `job_boards` array and `scan` namespace
- [ ] `--parallel N` flag + token bucket rate limiting in `scan.mjs`
- [ ] Content-hash column in `scan-history.tsv` with dual-key dedup
- [ ] `postedDate` parsing in all providers + freshness tracking
- [ ] `/career-ops scan --source=company|board|all` CLI command
- [ ] Updated `AGENTS.md` with scan mode documentation
- [ ] All existing scans still work (`node scan.mjs --dry-run` passes)

### Definition of Done
- [ ] `node scan.mjs --dry-run` finds 50+ sources (currently 40+)
- [ ] `--parallel 20` completes without rate-limit errors
- [ ] Dedup accuracy ≥95% on test corpus (no false positives on multi-board postings)
- [ ] `postedDate` populated for ≥90% of board results
- [ ] `/career-ops scan --source board` returns only board results
- [ ] All Phase 1-4 deliverables checked off

### Must Have
- Zero regression: existing company ATS scanning works identically
- `portals.yml` remains human-editable, single source of truth
- Providers auto-detected via `careers_url` pattern (no manual `provider:` required for standard ATS)
- `scan-history.tsv` backward compatible (URL column unchanged)

### Must NOT Have (Guardrails)
- No new config files (`sources.yml`, `boards.yml`, etc.) — everything in `portals.yml`
- No breaking changes to `scan.mjs` CLI without `--source` flag
- No external dependencies beyond existing (no new npm packages without approval)
- No hardcoded API keys — use env vars, document in `.env.example`
- No provider implementations >200 lines (split into `_shared.mjs` if needed)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test, vitest available via npm)
- **Automated tests**: Tests-after (implement then test)
- **Framework**: Native Node test runner (`node --test`) + custom verification scripts
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

| Domain | Tool | Verification Method |
|--------|------|---------------------|
| Provider implementation | Node (`node --test`) | Unit tests for parse/transform, integration test against live endpoint (mocked) |
| scan.mjs changes | Node + Bash | `node scan.mjs --dry-run`, `node scan.mjs --parallel 20 --source all` |
| Dedup logic | Node | Unit tests with fixtures: URL dedup, content-hash dedup, cross-board duplicate |
| Freshness | Node | Unit tests: parse `postedDate` from various formats, fallback to liveness |
| CLI | Bash | Run `/career-ops scan --help`, verify flags, integration test with mock providers |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — can start immediately):
├── Task 1: Provider scaffolding — create provider template + shared HTTP utilities [quick]
├── Task 2: portals.yml schema extension — add job_boards[] + scan{} namespace [quick]
├── Task 3: scan-history.tsv migration — add content_hash + posted_date columns [quick]

Wave 2 (Phase 1 — Board Providers, MAX PARALLEL — depends on Task 1,2):
├── Task 4: LinkedIn GraphQL provider [unspecified-high] ✅
├── Task 5: Glassdoor RSS provider [unspecified-high] ✅
├── Task 6: Wellfound (AngelList) provider [unspecified-high] ✅
├── Task 7: Otta provider [unspecified-high] ✅
├── Task 8: Hired provider [unspecified-high] ✅
├── Task 9: YC Jobs provider [unspecified-high] ✅
├── Task 10: RemoteOK provider [unspecified-high] ✅
├── Task 11: WeWorkRemotely provider [unspecified-high] ✅
├── Task 12: WorkingNomads provider [unspecified-high] ✅
├── Task 13: Himalayas provider [unspecified-high] ✅
├── Task 14: 4DayWeek provider [unspecified-high] ✅
├── Task 15: JobsAPI (Indeed-like) provider [unspecified-high] ✅
├── Task 16: Otta provider [unspecified-high] ✅ (same as Task 7 - WTTJ)
├── Task 17: Remotive provider [unspecified-high] ✅ ✅
├── Task 18: EU Remote Jobs provider [unspecified-high] ✅ (Arbeitnow)
├── Task 19: Jobicy provider [unspecified-high] ✅ ✅ (exists)
├── Task 20: Landing.jobs provider [unspecified-high] ✅ ✅ (exists)
├── Task 21: JustJoin.it provider [unspecified-high] ✅ ✅ (exists)
├── Task 22: NoFluffJobs provider [unspecified-high] ✅ ✅ (exists)
├── Task 23: Add all 20 providers to portals.yml job_boards [quick] ✅

Wave 3 (Phase 2 — Unified Parallel Worker — depends on Task 1,2,3):
├── Task 24: Token bucket implementation in providers/_http.mjs [deep]
├── Task 25: --parallel N flag + shared worker pool in scan.mjs [deep]
├── Task 26: Provider rate-limit config in portals.yml [quick]
├── Task 27: Performance benchmark script [quick]

Wave 4 (Phase 3 — Content Dedup + Freshness — depends on Task 3, 21):
├── Task 28: Content-hash column + dual-key dedup in loadSeenUrls() [deep]
├── Task 29: postedDate parsing in all board providers [unspecified-high]
├── Task 30: Freshness tracking + expires_at in scan-history.tsv [deep]
├── Task 31: Dedup test corpus + verification script [quick]

Wave 5 (Phase 4 — CLI Polish + Docs — depends on Task 25, 28):
├── Task 32: --source=company|board|all filter in scan.mjs [quick] ✅
├── Task 33: /career-ops scan command wiring + help text [quick] ✅
├── Task 34: AGENTS.md scan mode documentation [writing] ✅ ✅
├── Task 35: End-to-end verification script [quick] ✅

Wave FINAL (Integration — after ALL tasks):
├── Task F1: Full regression test — node scan.mjs --dry-run [oracle] ✅
├── Task F2: Parallel benchmark — --parallel 20 --source all [unspecified-high] ✅
├── Task F3: Dedup accuracy test on fixture corpus [oracle] ✅
├── Task F4: Freshness coverage report — postedDate % [unspecified-high] ✅
└── User explicit approval → DONE
```

### Dependency Matrix (abbreviated)

| Task | Blocks | Blocked By |
|------|--------|------------|
| 1,2,3 | 4-23, 24-27, 28-31 | - |
| 4-22 | 23 | 1,2 |
| 23 | 28, 32 | 4-22 |
| 24,25 | 32, 35 | 1,2,3 |
| 26 | 25 | 2 |
| 27 | - | 25 |
| 28 | 30, 31, 32 | 3, 23 |
| 29 | 30, 31 | 4-22 |
| 30 | 31 | 28 |
| 31 | - | 28, 29 |
| 32 | 35 | 25, 28 |
| 33 | 35 | 32 |
| 34 | - | 33 |
| 35 | F1-F4 | 32, 33, 34 |
| F1-F4 | User approval | 35 |

### Agent Dispatch Summary

- **Wave 1**: 3 — T1 `quick`, T2 `quick`, T3 `quick`
- **Wave 2**: 20 — T4-T22 `unspecified-high`, T23 `quick`
- **Wave 3**: 4 — T24 `deep`, T25 `deep`, T26 `quick`, T27 `quick`
- **Wave 4**: 4 — T28 `deep`, T29 `unspecified-high`, T30 `deep`, T31 `quick`
- **Wave 5**: 4 — T32 `quick`, T33 `quick`, T34 `writing`, T35 `quick`
- **FINAL**: 4 — F1 `oracle`, F2 `unspecified-high`, F3 `oracle`, F4 `unspecified-high`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> FORMAT: Task labels MUST use bare numbers: `1.`, `2.`, `3.` — NOT `T1.`, `Task 1.`, `Phase 1:`.

- [x] 1. Provider scaffolding — create provider template + shared HTTP utilities

  **What to do**:
  - Create `providers/_template.mjs` with standard provider interface: `detect(url)`, `fetch(config)`, `normalize(job)`, `rateLimit` config
  - Create `providers/_http.mjs` with shared `fetchWithRetry()`, `createTokenBucket()`, `parseRateLimitHeaders()` utilities
  - Ensure all providers export `{ detect, fetch, normalize, rateLimit }`
  - Add JSDoc comments for each function

  **Must NOT do**:
  - Do not add business logic to template — keep it minimal
  - Do not import external deps beyond native Node + existing utils

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Boilerplate creation, no complex logic
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: 4-22 (all provider implementations)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `providers/greenhouse.mjs` — Reference ATS provider pattern (detect + fetch + normalize)
  - `providers/ashby.mjs` — Reference GraphQL provider pattern
  - `providers/lever.mjs` — Reference REST API provider pattern
  - `scan.mjs` lines 1-50 — How providers are auto-loaded and detected
  - `providers/_http.mjs` (if exists) — Existing HTTP utilities to extend

  **Acceptance Criteria**:
  - [ ] `providers/_template.mjs` exists with detect/fetch/normalize/rateLimit exports
  - [ ] `providers/_http.mjs` exports `fetchWithRetry`, `createTokenBucket`, `parseRateLimitHeaders`
  - [ ] `node --test providers/_template.test.mjs` passes (create basic test)
  - [ ] No lint errors in new files

  **QA Scenarios**:
  ```
  Scenario: Provider template compiles and exports interface
    Tool: Bash (node)
    Preconditions: providers/_template.mjs created
    Steps:
      1. node -e "import './providers/_template.mjs'; console.log('OK')"
    Expected Result: Prints "OK" without errors
    Evidence: .omo/evidence/task-1-template-import.txt

  Scenario: Shared HTTP utilities work
    Tool: Bash (node)
    Preconditions: providers/_http.mjs created
    Steps:
      1. node -e "import { createTokenBucket } from './providers/_http.mjs'; const b = createTokenBucket({rate: '10/min', capacity: 5}); console.log('OK')"
    Expected Result: Prints "OK" without errors
    Evidence: .omo/evidence/task-1-http-utils.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-1-template-import.txt`
  - [ ] `.omo/evidence/task-1-http-utils.txt`

  **Commit**: YES
  - Message: `feat(providers): add provider template and shared HTTP utilities`
  - Files: `providers/_template.mjs`, `providers/_http.mjs`
  - Pre-commit: `node --test providers/_template.test.mjs providers/_http.test.mjs`

- [x] 2. portals.yml schema extension — add job_boards[] + scan{} namespace

  **What to do**:
  - Add `job_boards:` array to `portals.yml` (after `tracked_companies:`)
  - Add `scan:` namespace with `auto_detect`, `default_sources`, `filters`
  - Add `rate_limit` field to provider configs (per-provider)
  - Update `validate-portals.mjs` to validate new schema
  - Keep backward compatibility — all existing fields still work

  **Must NOT do**:
  - Do not remove or rename existing fields
  - Do not add new top-level keys beyond `job_boards` and `scan`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: YAML config edit + validation script update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: 4-22, 26
  - **Blocked By**: None

  **References**:
  - `portals.yml` lines 1-100 — Current structure (tracked_companies, job_boards, search_queries)
  - `validate-portals.mjs` — Validation logic to extend
  - `scan.mjs` — How portals.yml is loaded and used

  **Acceptance Criteria**:
  - [ ] `portals.yml` has `job_boards:` array with example entry
  - [ ] `portals.yml` has `scan:` namespace with `auto_detect`, `default_sources`, `filters`
  - [ ] `node validate-portals.mjs` passes with new schema
  - [ ] Existing `node scan.mjs --dry-run` still works

  **QA Scenarios**:
  ```
  Scenario: Extended portals.yml validates
    Tool: Bash (node)
    Preconditions: portals.yml edited
    Steps:
      1. node validate-portals.mjs
    Expected Result: Exit code 0, no validation errors
    Evidence: .omo/evidence/task-2-validate-portals.txt

  Scenario: scan.mjs still loads portals.yml
    Tool: Bash (node)
    Preconditions: portals.yml edited
    Steps:
      1. node -e "import { loadPortals } from './scan.mjs'; const p = await loadPortals(); console.log('job_boards:', p.job_boards?.length); console.log('scan:', !!p.scan)"
    Expected Result: Prints job_boards count > 0 and scan: true
    Evidence: .omo/evidence/task-2-scan-load.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-2-validate-portals.txt`
  - [ ] `.omo/evidence/task-2-scan-load.txt`

  **Commit**: YES
  - Message: `config(portals): add job_boards array and scan namespace`
  - Files: `portals.yml`, `validate-portals.mjs`
  - Pre-commit: `node validate-portals.mjs`

- [x] 3. scan-history.tsv migration — add content_hash + posted_date columns

  **What to do**:
  - Update `scan-history.tsv` header: `url\tfirst_seen\tportal\ttitle\tcompany\tstatus\tcontent_hash\tposted_date\texpires_at`
  - Create migration script `scripts/migrate-scan-history.mjs` that reads old TSV, writes new TSV with empty new columns
  - Update `loadSeenUrls()` in `scan.mjs` to handle both old and new column counts
  - Add `createContentHash()` utility to `scan.mjs` or `providers/_http.mjs`

  **Must NOT do**:
  - Do not lose existing scan history data
  - Do not change column order of existing fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: TSV column addition + migration script
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: 28, 29, 30, 31
  - **Blocked By**: None

  **References**:
  - `data/scan-history.tsv` — Current format (8 columns)
  - `scan.mjs` `loadSeenUrls()` function — Needs update for new columns
  - `merge-tracker.mjs` — Reference for TSV migration pattern

  **Acceptance Criteria**:
  - [ ] `data/scan-history.tsv` has 11 columns (url, first_seen, portal, title, company, status, content_hash, posted_date, expires_at)
  - [ ] `scripts/migrate-scan-history.mjs` exists and runs without data loss
  - [ ] `loadSeenUrls()` handles both 8-col and 11-col rows
  - [ ] `node scan.mjs --dry-run` works with migrated history

  **QA Scenarios**:
  ```
  Scenario: Migration preserves existing data
    Tool: Bash (node)
    Preconditions: data/scan-history.tsv exists with 8 columns
    Steps:
      1. cp data/scan-history.tsv data/scan-history.tsv.backup
      2. node scripts/migrate-scan-history.mjs
      3. diff -u <(cut -f1-6 data/scan-history.tsv.backup) <(cut -f1-6 data/scan-history.tsv)
    Expected Result: No differences in first 6 columns
    Evidence: .omo/evidence/task-3-migration-preserves.txt

  Scenario: loadSeenUrls handles old and new format
    Tool: Bash (node)
    Preconditions: scan.mjs updated
    Steps:
      1. node -e "import { loadSeenUrls } from './scan.mjs'; const r = await loadSeenUrls(); console.log('seen:', r.seen.size, 'content:', r.seenContent?.size)"
    Expected Result: Prints counts without errors
    Evidence: .omo/evidence/task-3-loadseenurls.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-3-migration-preserves.txt`
  - [ ] `.omo/evidence/task-3-loadseenurls.txt`

  **Commit**: YES
  - Message: `refactor(scan): add content_hash + posted_date columns to scan-history.tsv`
  - Files: `data/scan-history.tsv`, `scan.mjs`, `scripts/migrate-scan-history.mjs`
  - Pre-commit: `node scripts/migrate-scan-history.mjs && node scan.mjs --dry-run`

- [x] 4. LinkedIn GraphQL provider

  **What to do**:
  - Create `providers/linkedin.mjs` implementing detect/fetch/normalize
  - `detect(url)`: matches `linkedin.com/jobs` or `linkedin.com/jobs/search`
  - `fetch(config)`: POST to LinkedIn GraphQL endpoint with search variables, handle pagination
  - `normalize(job)`: map LinkedIn fields → standard schema (title, company, location, url, description, postedDate, source)
  - `rateLimit`: `{ requests: 30, window: '1min' }` (conservative for public endpoint)
  - Add to `portals.yml` job_boards with `provider: linkedin`

  **Must NOT do**:
  - Do not hardcode API keys — use `process.env.LINKEDIN_SESSION_COOKIE` or similar
  - Do not exceed rate limits — implement exponential backoff

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: GraphQL API reverse-engineering, pagination, rate limiting
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5-22)
  - **Blocks**: 23
  - **Blocked By**: 1, 2

  **References**:
  - `providers/ashby.mjs` — GraphQL provider pattern
  - `providers/_http.mjs` — fetchWithRetry, createTokenBucket
  - LinkedIn public job search GraphQL endpoint (reverse-engineered from browser devtools)
  - `portals.yml` job_boards section — Where to register

  **Acceptance Criteria**:
  - [ ] `providers/linkedin.mjs` exports detect, fetch, normalize, rateLimit
  - [ ] `detect('https://www.linkedin.com/jobs/search')` returns true
  - [ ] `fetch()` returns normalized jobs with postedDate
  - [ ] `node --test providers/linkedin.test.mjs` passes (mocked)
  - [ ] Added to `portals.yml` job_boards

  **QA Scenarios**:
  ```
  Scenario: LinkedIn provider detects correctly
    Tool: Bash (node)
    Preconditions: providers/linkedin.mjs created
    Steps:
      1. node -e "import { detect } from './providers/linkedin.mjs'; console.log(detect('https://linkedin.com/jobs/search')); console.log(detect('https://google.com'))"
    Expected Result: true, false
    Evidence: .omo/evidence/task-4-linkedin-detect.txt

  Scenario: LinkedIn provider normalizes job
    Tool: Bash (node)
    Preconditions: providers/linkedin.mjs created
    Steps:
      1. node -e "import { normalize } from './providers/linkedin.mjs'; const job = normalize({title:'SWE',companyName:'Acme',location:'SF',postedDate:'2024-01-15',description:'...',applyUrl:'https://...'}); console.log(JSON.stringify(job, null, 2))"
    Expected Result: Standard schema with title, company, location, url, description, postedDate, source
    Evidence: .omo/evidence/task-4-linkedin-normalize.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-4-linkedin-detect.txt`
  - [ ] `.omo/evidence/task-4-linkedin-normalize.txt`

  **Commit**: YES
  - Message: `feat(providers): add LinkedIn GraphQL provider`
  - Files: `providers/linkedin.mjs`, `providers/linkedin.test.mjs`, `portals.yml`
  - Pre-commit: `node --test providers/linkedin.test.mjs && node validate-portals.mjs`

- [x] 5. Glassdoor RSS provider

  **What to do**:
  - Create `providers/glassdoor.mjs` with RSS feed parsing
  - `detect(url)`: matches `glassdoor.com/Job` or RSS feed URLs
  - `fetch(config)`: Fetch RSS feed, parse XML, extract job entries
  - `normalize(job)`: Map RSS fields → standard schema (title, company, location, url, description, postedDate)
  - `rateLimit`: `{ requests: 60, window: '1min' }` (RSS is lightweight)
  - Add to `portals.yml` job_boards

  **Must NOT do**:
  - Do not use heavy XML parsers — use native DOMParser or fast-xml-parser if needed
  - Do not assume all RSS fields present — handle missing gracefully

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: RSS/XML parsing, date format normalization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6-22)
  - **Blocks**: 23
  - **Blocked By**: 1, 2

  **References**:
  - `providers/_http.mjs` — fetchWithRetry
  - Glassdoor RSS feed format (e.g., `https://www.glassdoor.com/Job/rss.htm`)
  - `portals.yml` job_boards section

  **Acceptance Criteria**:
  - [ ] `providers/glassdoor.mjs` exports detect, fetch, normalize, rateLimit
  - [ ] Parses RSS XML to job array
  - [ ] Normalizes to standard schema with postedDate
  - [ ] Added to `portals.yml` job_boards

  **QA Scenarios**:
  ```
  Scenario: Glassdoor provider parses RSS
    Tool: Bash (node)
    Preconditions: providers/glassdoor.mjs created
    Steps:
      1. node -e "import { fetch } from './providers/glassdoor.mjs'; const jobs = await fetch({}); console.log('jobs:', jobs.length); console.log(JSON.stringify(jobs[0], null, 2))"
    Expected Result: Array of normalized jobs with postedDate
    Evidence: .omo/evidence/task-5-glassdoor-fetch.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-5-glassdoor-fetch.txt`

  **Commit**: YES
  - Message: `feat(providers): add Glassdoor RSS provider`
  - Files: `providers/glassdoor.mjs`, `providers/glassdoor.test.mjs`, `portals.yml`

- [x] 6. Wellfound (AngelList) provider

  **What to do**:
  - Create `providers/wellfound.mjs` for Wellfound API
  - `detect(url)`: matches `wellfound.com/jobs` or `angel.co/jobs`
  - `fetch(config)`: GraphQL or REST endpoint, handle auth via env var
  - `normalize(job)`: Map Wellfound fields → standard schema
  - `rateLimit`: `{ requests: 30, window: '1min' }`
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: API exploration, auth handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 23
  - **Blocked By**: 1, 2

  **Acceptance Criteria**: Same pattern as Task 4

  **Commit**: YES - `feat(providers): add Wellfound provider`

- [x] 7. Otta provider

  **What to do**:
  - Create `providers/otta.mjs` for Otta job board
  - `detect(url)`: matches `otta.com/jobs`
  - `fetch(config)`: API or HTML scraping with Playwright fallback
  - `normalize(job)`: Standard schema
  - `rateLimit`: Conservative
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Otta provider`

- [x] 8. Hired provider

  **What to do**:
  - Create `providers/hired.mjs` for Hired.com
  - `detect(url)`: matches `hired.com/jobs`
  - `fetch(config)`: API or scraping
  - `normalize(job)`: Standard schema
  - `rateLimit`: Conservative
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Hired provider`

- [x] 9. YC Jobs provider

  **What to do**:
  - Create `providers/ycjobs.mjs` for Y Combinator job board
  - `detect(url)`: matches `ycombinator.com/companies/*/jobs` or `workatastartup.com`
  - `fetch(config)`: HTML scraping or API if available
  - `normalize(job)`: Standard schema (extract startup name, role, location)
  - `rateLimit`: `{ requests: 20, window: '1min' }`
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add YC Jobs provider`

- [x] 10. RemoteOK provider

  **What to do**:
  - Create `providers/remoteok.mjs` for RemoteOK.io
  - `detect(url)`: matches `remoteok.io/remote-jobs` or `remoteok.com`
  - `fetch(config)`: JSON API at `https://remoteok.io/api`
  - `normalize(job)`: Standard schema (RemoteOK has good structured data)
  - `rateLimit`: `{ requests: 60, window: '1min' }`
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add RemoteOK provider`

- [x] 11. WeWorkRemotely provider

  **What to do**:
  - Create `providers/weworkremotely.mjs`
  - `detect(url)`: matches `weworkremotely.com/remote-jobs`
  - `fetch(config)`: HTML scraping (no public API)
  - `normalize(job)`: Standard schema
  - `rateLimit`: Conservative
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add WeWorkRemotely provider`

- [x] 12. WorkingNomads provider

  **What to do**:
  - Create `providers/workingnomads.mjs`
  - `detect(url)`: matches `workingnomads.com/jobs`
  - `fetch(config)`: RSS or HTML
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add WorkingNomads provider`

- [x] 13. Himalayas provider

  **What to do**:
  - Create `providers/himalayas.mjs` for Himalayas.app
  - `detect(url)`: matches `himalayas.app/jobs`
  - `fetch(config)`: GraphQL API
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Himalayas provider`

- [x] 14. 4DayWeek provider

  **What to do**:
  - Create `providers/4dayweek.mjs` for 4dayweek.io
  - `detect(url)`: matches `4dayweek.io/jobs`
  - `fetch(config)`: JSON API or HTML
  - `normalize(job)`: Standard schema (highlight 4-day week roles)
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add 4DayWeek provider`

- [x] 15. JobsAPI (Indeed-like) provider

  **What to do**:
  - Create `providers/jobsapi.mjs` for JobsAPI aggregator
  - `detect(url)`: matches `jobsapi.com` or similar
  - `fetch(config)`: REST API with pagination
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add JobsAPI provider`

- [x] 16. Remotive provider

  **What to do**:
  - Create `providers/remotive.mjs` for Remotive.com
  - `detect(url)`: matches `remotive.com/remote-jobs`
  - `fetch(config)`: JSON API at `https://remotive.com/api/remote-jobs`
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Remotive provider`

- [x] 17. EU Remote Jobs provider

  **What to do**:
  - Create `providers/euremotejobs.mjs`
  - `detect(url)`: matches `euremotejobs.com`
  - `fetch(config)`: HTML or API
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add EU Remote Jobs provider`

- [x] 18. Jobicy provider

  **What to do**:
  - Create `providers/jobicy.mjs`
  - `detect(url)`: matches `jobicy.com/jobs`
  - `fetch(config)`: API or scraping
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Jobicy provider`

- [x] 19. Landing.jobs provider

  **What to do**:
  - Create `providers/landingjobs.mjs` for Landing.jobs (EU tech)
  - `detect(url)`: matches `landing.jobs` or `landingjobs.com`
  - `fetch(config)`: API or HTML
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add Landing.jobs provider`

- [x] 20. JustJoin.it provider

  **What to do**:
  - Create `providers/justjoin.mjs` for JustJoin.it (Poland tech)
  - `detect(url)`: matches `justjoin.it`
  - `fetch(config)`: Public API
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add JustJoin.it provider`

- [x] 21. NoFluffJobs provider

  **What to do**:
  - Create `providers/nofluffjobs.mjs` for NoFluffJobs (Poland tech)
  - `detect(url)`: matches `nofluffjobs.com`
  - `fetch(config)`: Public API
  - `normalize(job)`: Standard schema
  - Add to `portals.yml` job_boards

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add NoFluffJobs provider`

- [x] 22. (Buffer task for additional board provider)

  **What to do**:
  - Reserve slot for any additional board discovered during implementation
  - Could be: Otta (duplicate check), JobTeaser, WelcomeToTheJungle, etc.
  - Same pattern as Tasks 4-21

  **Recommended Agent Profile**: `unspecified-high`

  **Parallelization**: Wave 2

  **Commit**: YES - `feat(providers): add [provider-name] provider`

- [x] 23. Add all 20 providers to portals.yml job_boards

  **What to do**:
  - Edit `portals.yml` job_boards array with all 20 providers
  - Each entry: `name`, `provider`, `enabled: true`, optional `rate_limit`
  - Run `node validate-portals.mjs` to verify
  - Test `node scan.mjs --dry-run` shows all boards

  **Must NOT do**:
  - Do not enable providers that aren't implemented yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: YAML config update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after providers implemented)
  - **Parallel Group**: Wave 2 (after Tasks 4-22)
  - **Blocks**: 28, 32
  - **Blocked By**: 4-22

  **References**:
  - `portals.yml` job_boards section
  - `validate-portals.mjs`

  **Acceptance Criteria**:
  - [ ] `portals.yml` has 20+ entries in job_boards
  - [ ] `node validate-portals.mjs` passes
  - [ ] `node scan.mjs --dry-run` lists all board providers

  **QA Scenarios**:
  ```
  Scenario: All board providers registered
    Tool: Bash (node)
    Preconditions: portals.yml updated
    Steps:
      1. node -e "import { loadPortals } from './scan.mjs'; const p = await loadPortals(); console.log('boards:', p.job_boards.length); p.job_boards.forEach(b => console.log(' -', b.name, b.provider))"
    Expected Result: Lists 20+ boards with provider names
    Evidence: .omo/evidence/task-23-boards-registered.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-23-boards-registered.txt`

  **Commit**: YES
  - Message: `config(portals): register 20+ board providers in job_boards`
  - Files: `portals.yml`

- [x] 24. Token bucket implementation in providers/_http.mjs

  **What to do**:
  - Implement `createTokenBucket({ rate, capacity })` with:
    - `acquire()` — returns promise that resolves when token available
    - `tryAcquire()` — returns boolean, non-blocking
    - Refill logic: tokens added at `rate` interval
    - Per-provider isolation (each provider gets own bucket)
  - Implement `parseRateLimitHeaders(response)` — extracts `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
  - Add dynamic rate adjustment: if `Retry-After` seen, reduce bucket rate
  - Export both from `providers/_http.mjs`

  **Must NOT do**:
  - Do not block event loop — use setTimeout/setInterval for refill
  - Do not hardcode rates — read from provider config

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Concurrency primitive, requires careful async design
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 25, 26, 27)
  - **Blocks**: 25
  - **Blocked By**: 1, 2, 3

  **References**:
  - `providers/_http.mjs` — Where to add
  - Token bucket algorithm (standard)
  - `scan.mjs` — Where token bucket will be used

  **Acceptance Criteria**:
  - [ ] `createTokenBucket` works: `const b = createTokenBucket({rate: '10/min', capacity: 5}); await b.acquire();`
  - [ ] `parseRateLimitHeaders` extracts standard headers
  - [ ] Unit tests pass: refill, exhaustion, dynamic adjustment
  - [ ] No memory leaks (buckets cleaned up)

  **QA Scenarios**:
  ```
  Scenario: Token bucket refills over time
    Tool: Bash (node)
    Preconditions: providers/_http.mjs updated
    Steps:
      1. node -e "
         import { createTokenBucket } from './providers/_http.mjs';
         const b = createTokenBucket({rate: '60/min', capacity: 2});
         await b.acquire(); await b.acquire();
         const start = Date.now();
         await b.acquire();
         console.log('waited:', Date.now() - start, 'ms');
       "
    Expected Result: Waited ~1000ms (1 token per second at 60/min)
    Evidence: .omo/evidence/task-24-token-bucket-refill.txt

  Scenario: Rate limit headers parsed
    Tool: Bash (node)
    Preconditions: providers/_http.mjs updated
    Steps:
      1. node -e "
         import { parseRateLimitHeaders } from './providers/_http.mjs';
         const h = { 'x-ratelimit-limit': '100', 'x-ratelimit-remaining': '5', 'retry-after': '30' };
         console.log(JSON.stringify(parseRateLimitHeaders(h), null, 2));
       "
    Expected Result: { limit: 100, remaining: 5, retryAfter: 30000 }
    Evidence: .omo/evidence/task-24-rate-limit-headers.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-24-token-bucket-refill.txt`
  - [ ] `.omo/evidence/task-24-rate-limit-headers.txt`

  **Commit**: YES
  - Message: `feat(providers): add token bucket rate limiting in _http.mjs`
  - Files: `providers/_http.mjs`, `providers/_http.test.mjs`

- [x] 25. --parallel N flag + shared worker pool in scan.mjs

  **What to do**:
  - Add `--parallel N` flag to `scan.mjs` (default: 10, env: `SCAN_PARALLEL`)
  - Replace fixed `CONCURRENCY = 10` with dynamic limit from flag
  - Implement `parallelFetch(tasks, limit, tokenBucket)` function:
    - Shared token bucket across all providers
    - Per-provider bucket from provider config
    - Worker pool: `Array.from({ length: Math.min(limit, tasks.length) }, () => next())`
    - Each worker: `await tokenBucket.acquire(); await task();`
    - Error handling: wrap each task in try/catch, log error, continue
  - Ensure company ATS + board aggregators both use same worker pool
  - Add `--throttle MS` flag for jittered delay between requests

  **Must NOT do**:
  - Do not break existing sequential fallback
  - Do not remove provider-specific rate limits

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core scan.mjs rewrite, concurrency, error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 24, 26, 27)
  - **Blocks**: 32, 35
  - **Blocked By**: 1, 2, 3, 24

  **References**:
  - `scan.mjs` — Current concurrency logic (search for CONCURRENCY)
  - `providers/_http.mjs` — Token bucket from Task 24
  - `portals.yml` — Provider rate_limit configs

  **Acceptance Criteria**:
  - [ ] `node scan.mjs --parallel 20 --dry-run` works
  - [ ] `node scan.mjs --parallel 5 --source all` completes
  - [ ] Company ATS and board providers both use worker pool
  - [ ] Rate limiting respected (no 429 errors in normal operation)
  - [ ] Errors in one provider don't block others

  **QA Scenarios**:
  ```
  Scenario: Parallel flag works
    Tool: Bash (node)
    Preconditions: scan.mjs updated
    Steps:
      1. node scan.mjs --parallel 20 --dry-run 2>&1 | grep -E 'parallel|Companies scanned|New offers'
    Expected Result: Shows parallel execution, completes without errors
    Evidence: .omo/evidence/task-25-parallel-flag.txt

  Scenario: Mixed sources use worker pool
    Tool: Bash (node)
    Preconditions: scan.mjs updated, portals.yml has job_boards
    Steps:
      1. node scan.mjs --parallel 10 --source all --dry-run 2>&1 | grep -E 'job_boards|tracked_companies'
    Expected Result: Both source types processed
    Evidence: .omo/evidence/task-25-mixed-sources.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-25-parallel-flag.txt`
  - [ ] `.omo/evidence/task-25-mixed-sources.txt`

  **Commit**: YES
  - Message: `feat(scan): add --parallel flag with shared worker pool and token bucket`
  - Files: `scan.mjs`, `providers/_http.mjs`

- [x] 26. Provider rate-limit config in portals.yml

  **What to do**:
  - Add `rate_limit` field to provider configs in `portals.yml`:
    ```yaml
    job_boards:
      - name: LinkedIn
        provider: linkedin
        rate_limit: "30/min"
        enabled: true
    ```
  - Update `scan.mjs` to read `rate_limit` and pass to token bucket
  - Default: `"100/min"` if not specified
  - Support formats: `"30/min"`, `"100/hour"`, `"10/sec"`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Config field addition + parsing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 24, 25, 27)
  - **Blocks**: 25
  - **Blocked By**: 2

  **References**:
  - `portals.yml` job_boards entries
  - `scan.mjs` provider config loading

  **Acceptance Criteria**:
  - [ ] `portals.yml` has `rate_limit` on board providers
  - [ ] `scan.mjs` reads and uses rate_limit
  - [ ] Default applied when missing

  **QA Scenarios**:
  ```
  Scenario: Rate limit config read correctly
    Tool: Bash (node)
    Preconditions: portals.yml updated, scan.mjs updated
    Steps:
      1. node -e "import { loadPortals } from './scan.mjs'; const p = await loadPortals(); p.job_boards.forEach(b => console.log(b.name, b.rate_limit))"
    Expected Result: Each board shows rate_limit
    Evidence: .omo/evidence/task-26-rate-limit-config.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-26-rate-limit-config.txt`

  **Commit**: YES
  - Message: `config(portals): add rate_limit field to job_boards`
  - Files: `portals.yml`, `scan.mjs`

- [x] 27. Performance benchmark script

  **What to do**:
  - Create `scripts/benchmark-scan.mjs`:
    - Runs `scan.mjs --parallel N --dry-run` for N=1,5,10,20,50
    - Measures: total time, offers found, rate limit errors, memory
    - Outputs JSON + markdown table
  - Add npm script: `"benchmark": "node scripts/benchmark-scan.mjs"`
  - Document in AGENTS.md

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Benchmark script, no core logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 24, 25, 26)
  - **Blocks**: None
  - **Blocked By**: 25

  **References**:
  - `scan.mjs` — What to benchmark
  - `package.json` — npm scripts

  **Acceptance Criteria**:
  - [ ] `npm run benchmark` runs and outputs results
  - [ ] Results show scaling with parallel N
  - [ ] JSON + markdown output

  **QA Scenarios**:
  ```
  Scenario: Benchmark runs
    Tool: Bash (node)
    Preconditions: scripts/benchmark-scan.mjs created
    Steps:
      1. npm run benchmark 2>&1 | tail -20
    Expected Result: Shows benchmark table with parallel scaling
    Evidence: .omo/evidence/task-27-benchmark.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-27-benchmark.txt`

  **Commit**: YES
  - Message: `scripts: add scan benchmark script`
  - Files: `scripts/benchmark-scan.mjs`, `package.json`

- [x] 28. Content-hash column + dual-key dedup in loadSeenUrls()

  **What to do**:
  - Implement `createContentHash(description)` using `crypto.createHash('sha256')`
  - Update `loadSeenUrls()` in `scan.mjs`:
    - Read new `content_hash` and `posted_date` columns from TSV
    - Maintain `seenContent` Map: `contentHash -> url`
    - Dual-key logic:
      ```javascript
      // URL-based dedup (permanent) for ATS
      if (PERMANENT_SCAN_HISTORY_STATUSES.has(status)) {
        seen.add(url);
        continue;
      }
      // Content-based dedup for boards without stable URLs
      if (description && seenContent.has(contentHash)) {
        continue; // Skip duplicate content
      }
      if (description) seenContent.set(contentHash, url);
      ```
    - Return `{ seen, seenContent }`
  - Update `saveScanHistory()` to write content_hash and posted_date

  **Must NOT do**:
  - Do not dedup across different companies (same title at different companies = different jobs)
  - Do not use content-hash for ATS sources (URL is stable)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core dedup logic rewrite, backward compatibility critical
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 29, 30, 31)
  - **Blocks**: 30, 31, 32
  - **Blocked By**: 3, 23

  **References**:
  - `scan.mjs` `loadSeenUrls()` and `saveScanHistory()`
  - `data/scan-history.tsv` — 11-column format from Task 3
  - `crypto` module — content hashing

  **Acceptance Criteria**:
  - [ ] `loadSeenUrls()` returns `{ seen, seenContent }`
  - [ ] URL dedup works for ATS sources
  - [ ] Content-hash dedup works for board sources
  - [ ] Cross-company same-title NOT deduped
  - [ ] `node scan.mjs --dry-run` produces correct dedup counts

  **QA Scenarios**:
  ```
  Scenario: URL dedup for ATS
    Tool: Bash (node)
    Preconditions: scan.mjs updated, scan-history.tsv has ATS entries
    Steps:
      1. node -e "import { loadSeenUrls } from './scan.mjs'; const r = await loadSeenUrls(); console.log('URL seen:', r.seen.size)"
    Expected Result: URL count matches expected
    Evidence: .omo/evidence/task-28-url-dedup.txt

  Scenario: Content-hash dedup for boards
    Tool: Bash (node)
    Preconditions: scan.mjs updated, scan-history.tsv has board entries with descriptions
    Steps:
      1. node -e "import { loadSeenUrls } from './scan.mjs'; const r = await loadSeenUrls(); console.log('Content seen:', r.seenContent.size)"
    Expected Result: Content hash count > 0
    Evidence: .omo/evidence/task-28-content-dedup.txt

  Scenario: Cross-company not deduped
    Tool: Bash (node)
    Preconditions: Fixture TSV with same title at CompanyA and CompanyB
    Steps:
      1. Create test fixture with duplicate titles at different companies
      2. Run loadSeenUrls on fixture
      3. Verify both kept
    Expected Result: Both jobs kept (different companies)
    Evidence: .omo/evidence/task-28-cross-company.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-28-url-dedup.txt`
  - [ ] `.omo/evidence/task-28-content-dedup.txt`
  - [ ] `.omo/evidence/task-28-cross-company.txt`

  **Commit**: YES
  - Message: `feat(scan): add content-hash dual-key dedup in loadSeenUrls`
  - Files: `scan.mjs`

- [x] 29. postedDate parsing in all board providers

  **What to do**:
  - For each board provider (Tasks 4-22), ensure `normalize(job)` returns `postedDate` in ISO 8601 format (`YYYY-MM-DD`)
  - Handle various date formats:
    - LinkedIn: `postedAt` timestamp → ISO date
    - Glassdoor RSS: `<pubDate>` → ISO date
    - RemoteOK: `date` field → ISO date
    - Wellfound: `created_at` → ISO date
    - YC Jobs: relative dates ("2 days ago") → ISO date
    - Default: `new Date().toISOString().split('T')[0]` if missing
  - Add `postedDate` to normalized job schema
  - Update `scan.mjs` to pass `postedDate` to `saveScanHistory()`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Date parsing across 20 providers, format normalization
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 28, 30, 31)
  - **Blocks**: 30, 31
  - **Blocked By**: 4-22

  **References**:
  - Each provider's `normalize()` function
  - `scan.mjs` job schema
  - Date parsing utilities (native `Date` or `date-fns` if available)

  **Acceptance Criteria**:
  - [ ] All 20 board providers return `postedDate` in ISO format
  - [ ] Missing dates get today's date as fallback
  - [ ] `scan-history.tsv` `posted_date` column populated

  **QA Scenarios**:
  ```
  Scenario: All providers have postedDate
    Tool: Bash (node)
    Preconditions: All providers updated
    Steps:
      1. node -e "
         import { loadPortals } from './scan.mjs';
         const p = await loadPortals();
         for (const b of p.job_boards) {
           const mod = await import('./providers/' + b.provider + '.mjs');
           const job = mod.normalize({/* minimal fixture */});
           console.log(b.provider, job.postedDate ? 'OK' : 'MISSING');
         }
       "
    Expected Result: All 20 providers show OK
    Evidence: .omo/evidence/task-29-all-posteddate.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-29-all-posteddate.txt`

  **Commit**: YES (per provider, or batched)
  - Message: `feat(providers): add postedDate parsing to [provider]`
  - Files: `providers/[provider].mjs`

- [x] 30. Freshness tracking + expires_at in scan-history.tsv

  **What to do**:
  - Add `expires_at` column to `scan-history.tsv` (calculated as `postedDate + 30 days` default)
  - In `scan.mjs`, when saving new jobs:
    - Parse `postedDate` from provider
    - Calculate `expiresAt = new Date(postedDate).getTime() + 30*24*60*60*1000`
    - Write to `expires_at` column (ISO date)
  - Add `isFresh(job)` helper: `new Date(job.postedDate) > new Date(Date.now() - 7*24*60*60*1000)`
  - Add `--fresh-only` flag to `scan.mjs` to filter by freshness

  **Must NOT do**:
  - Do not hardcode 30 days — make configurable via `portals.yml` `scan.freshness_window_days`

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Freshness logic, TSV schema, CLI flag
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 28, 29, 31)
  - **Blocks**: 31
  - **Blocked By**: 28, 29

  **References**:
  - `scan.mjs` `saveScanHistory()` and CLI flags
  - `data/scan-history.tsv` — 11-column format
  - `portals.yml` `scan` namespace for config

  **Acceptance Criteria**:
  - [ ] `expires_at` column populated for new jobs
  - [ ] `isFresh()` correctly identifies jobs < 7 days old
  - [ ] `--fresh-only` flag filters correctly

  **QA Scenarios**:
  ```
  Scenario: expires_at calculated
    Tool: Bash (node)
    Preconditions: scan.mjs updated, new job with postedDate
    Steps:
      1. Run scan.mjs to add new job
      2. Check scan-history.tsv last line: cut -f9 data/scan-history.tsv
    Expected Result: ISO date ~30 days from postedDate
    Evidence: .omo/evidence/task-30-expires-at.txt

  Scenario: fresh-only flag works
    Tool: Bash (node)
    Preconditions: scan-history.tsv has fresh and stale jobs
    Steps:
      1. node scan.mjs --fresh-only --dry-run 2>&1 | grep 'New offers'
    Expected Result: Only fresh jobs counted
    Evidence: .omo/evidence/task-30-fresh-only.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-30-expires-at.txt`
  - [ ] `.omo/evidence/task-30-fresh-only.txt`

  **Commit**: YES
  - Message: `feat(scan): add freshness tracking with expires_at and --fresh-only flag`
  - Files: `scan.mjs`, `data/scan-history.tsv`

- [x] 31. Dedup test corpus + verification script

  **What to do**:
  - Create `tests/fixtures/dedup-test.tsv` with test cases:
    - Same URL, different status (should dedup by URL)
    - Same content, different URLs (should dedup by content-hash for boards)
    - Same title, different companies (should NOT dedup)
    - Same company, same title, different dates (should dedup by content-hash)
    - Missing description (should fall back to URL dedup)
  - Create `scripts/verify-dedup.mjs`:
    - Loads fixture TSV
    - Runs `loadSeenUrls()` 
    - Asserts expected dedup behavior
    - Outputs PASS/FAIL with details
  - Add npm script: `"verify:dedup": "node scripts/verify-dedup.mjs"`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test fixtures + verification script
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 28, 29, 30)
  - **Blocks**: None
  - **Blocked By**: 28, 29, 30

  **References**:
  - `scan.mjs` `loadSeenUrls()`
  - `data/scan-history.tsv` format
  - Node test runner

  **Acceptance Criteria**:
  - [ ] `npm run verify:dedup` passes all test cases
  - [ ] Fixture covers all dedup scenarios
  - [ ] Script outputs clear PASS/FAIL

  **QA Scenarios**:
  ```
  Scenario: Dedup verification passes
    Tool: Bash (node)
    Preconditions: scripts/verify-dedup.mjs and fixture created
    Steps:
      1. npm run verify:dedup
    Expected Result: All test cases PASS
    Evidence: .omo/evidence/task-31-verify-dedup.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-31-verify-dedup.txt`

  **Commit**: YES
  - Message: `test: add dedup verification corpus and script`
  - Files: `tests/fixtures/dedup-test.tsv`, `scripts/verify-dedup.mjs`, `package.json`

- [x] 32. --source=company|board|all filter in scan.mjs

  **What to do**:
  - Add `--source TYPE` flag to `scan.mjs` (choices: `company`, `board`, `all`; default: `all`)
  - Filter `tracked_companies` vs `job_boards` based on flag:
    - `company`: only `tracked_companies`
    - `board`: only `job_boards`
    - `all`: both (current behavior)
  - Add `--company NAME` and `--board NAME` sub-filters for single-source runs
  - Update help text: `scan.mjs --help` shows new flags

  **Must NOT do**:
  - Do not break `--dry-run` or `--verify` flags
  - Do not change default behavior (`all`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CLI flag addition + filtering logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 33, 34, 35)
  - **Blocks**: 35
  - **Blocked By**: 25, 28

  **References**:
  - `scan.mjs` CLI argument parsing (search for `process.argv` or argument parser)
  - `portals.yml` `tracked_companies` and `job_boards`

  **Acceptance Criteria**:
  - [ ] `node scan.mjs --source company --dry-run` only scans companies
  - [ ] `node scan.mjs --source board --dry-run` only scans boards
  - [ ] `node scan.mjs --source all --dry-run` scans both
  - [ ] `node scan.mjs --company Anthropic --dry-run` scans single company
  - [ ] `node scan.mjs --board LinkedIn --dry-run` scans single board

  **QA Scenarios**:
  ```
  Scenario: Source filter company
    Tool: Bash (node)
    Preconditions: scan.mjs updated, portals.yml has both
    Steps:
      1. node scan.mjs --source company --dry-run 2>&1 | grep -E 'Companies scanned|Job boards scanned'
    Expected Result: Companies scanned > 0, Job boards scanned: 0
    Evidence: .omo/evidence/task-32-source-company.txt

  Scenario: Source filter board
    Tool: Bash (node)
    Preconditions: scan.mjs updated, portals.yml has both
    Steps:
      1. node scan.mjs --source board --dry-run 2>&1 | grep -E 'Companies scanned|Job boards scanned'
    Expected Result: Companies scanned: 0, Job boards scanned > 0
    Evidence: .omo/evidence/task-32-source-board.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-32-source-company.txt`
  - [ ] `.omo/evidence/task-32-source-board.txt`

  **Commit**: YES
  - Message: `feat(scan): add --source filter for company|board|all`
  - Files: `scan.mjs`

- [x] 33. /career-ops scan command wiring + help text

  **What to do**:
  - Update the career-ops skill/router to wire `scan` command to `scan.mjs`
  - Add `--help` text for new flags: `--parallel`, `--source`, `--company`, `--board`, `--throttle`, `--fresh-only`, `--verify`
  - Ensure command works from any directory (uses project root)
  - Test: `/career-ops scan --help` shows all options

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CLI wiring, help text
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 32, 34, 35)
  - **Blocks**: 35
  - **Blocked By**: 32

  **References**:
  - `.agents/skills/career-ops/SKILL.md` — Command router
  - `.claude/skills/career-ops/SKILL.md` — Claude Code integration
  - `.opencode/skills/career-ops/SKILL.md` — OpenCode integration

  **Acceptance Criteria**:
  - [ ] `/career-ops scan --help` shows all new flags
  - [ ] `/career-ops scan --parallel 20 --source board` works
  - [ ] Works from any subdirectory

  **QA Scenarios**:
  ```
  Scenario: Career-ops scan command works
    Tool: Bash (node)
    Preconditions: Skill updated
    Steps:
      1. node -e "import { scan } from './.agents/skills/career-ops/SKILL.md'; console.log('wired')" 2>&1 || echo "Check skill file"
    Expected Result: Command recognized
    Evidence: .omo/evidence/task-33-scan-command.txt
  ```

  **Evidence to Capture**:
  - [ ] `.omo/evidence/task-33-scan-command.txt`

  **Commit**: YES
  - Message: `skill(career-ops): wire scan command with new flags`
  - Files: `.agents/skills/career-ops/SKILL.md`, `.claude/skills/career-ops/SKILL.md`, `.opencode/skills/career-ops/SKILL.md`

- [x] 34. AGENTS.md scan mode documentation

  **What to do**:
  - Add "Scan Mode" section to `AGENTS.md` (after existing modes):
    - Purpose: discover new offers across all configured sources
    - Source types: company, board, all
    - Flags: `--parallel`, `--source`, `--company`, `--board`, `--throttle`, `--fresh-only`, `--verify`
    - Examples (from porting plan)
    - Configuration: `portals.yml` `job_boards`, `scan` namespace
    - Output: `data/pipeline.md`, `data/scan-history.tsv`
  - Keep consistent with existing mode documentation style

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation writing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 32, 33, 35)
  - **Blocks**: None
  - **Blocked By**: 33

  **References**:
  - `AGENTS.md` — Existing mode documentation style
  - `docs/porting-plan.md` — CLI examples to document

  **Accept