# Career-Ops Piloting Guide

**Complete workflow for operating the career-ops job search command center.**

This guide assumes you've completed [SETUP.md](SETUP.md) and have the system running in your AI CLI.

---

## Table of Contents

1. [Daily Workflow](#daily-workflow)
2. [Evaluating an Offer](#evaluating-an-offer)
3. [Scanning for New Offers](#scanning-for-new-offers)
4. [Processing the Pipeline](#processing-the-pipeline)
5. [Generating PDFs](#generating-pdfs)
6. [Batch Evaluation](#batch-evaluation)
7. [Tracking Applications](#tracking-applications)
8. [Interview Preparation](#interview-preparation)
9. [Negotiation](#negotiation)
10. [Maintenance](#maintenance)

---

## Daily Workflow

### Morning (5 min)

```bash
# 1. Scan for new offers
/career-ops scan
# or: node scan.mjs --verify --throttle=8000
```

### After Scan (10-15 min)

```bash
# 2. Review new matches in pipeline.md
/career-ops pipeline
# or: Open data/pipeline.md and review

# 3. Evaluate promising ones
/career-ops "paste job URL here"
# or: paste JD directly
```

### Evening (as needed)

```bash
# 4. Generate PDFs for applications
/career-ops pdf

# 5. Update tracker statuses
/career-ops tracker
```

---

## Evaluating an Offer

### Auto-Pipeline (Recommended)

Paste a job URL or description. Career-ops runs the full pipeline:

```
Input → Archetype Detection → A-F Evaluation → Report + PDF + Tracker Entry
```

**What you get:**
- `reports/{NNN}-{company}-{date}.md` — Full evaluation (Blocks A-F + G)
- `output/{NNN}-{company}-{date}.pdf` — ATS-optimized CV
- Tracker entry in `data/applications.md` (via TSV merge)

### Manual Evaluation Modes

| Mode | Use Case |
|------|----------|
| `/career-ops oferta` | Evaluate single offer, no PDF |
| `/career-ops deep` | Deep company research (culture, comp, interview intel) |
| `/career-ops training` | Evaluate a course/certification |
| `/career-ops project` | Evaluate a portfolio project for relevance |

### Understanding the Report

Each report has **Blocks A-G**:

| Block | Contents |
|-------|----------|
| **A** | Role Summary — what they're hiring for |
| **B** | CV Match — score (0-5), gaps, keyword alignment |
| **C** | Level Strategy — how to frame your experience |
| **D** | Comp Research — market data, negotiation anchors |
| **E** | Personalization — tailored CV sections, cover letter angles |
| **F** | Interview Prep — STAR+R stories, likely questions |
| **G** | Posting Legitimacy — scam/ghost job detection |

**Score threshold:** System strongly recommends against applying below **4.0/5**.

---

## Scanning for New Offers

### Standard Scan (Zero Token Cost)

```bash
node scan.mjs                    # All companies + boards
node scan.mjs --source company   # Tracked companies only (ATS APIs)
node scan.mjs --source board     # Job boards only (LinkedIn, RemoteOK, etc.)
node scan.mjs --fresh-only       # Last 7 days only
node scan.mjs --fresh-only=14    # Last 14 days
node scan.mjs --company anthropic # Single company
node scan.mjs --parallel 20       # Higher concurrency
```

### Verified Scan (Playwright)

```bash
node scan.mjs --verify           # Liveness check (drops expired)
node scan.mjs --verify --throttle=8000  # Custom throttle
node scan.mjs --verify --headed-fallback # Retry anti-bot in headed browser
```

### Discovery Scan (Broader)

```bash
npm run scan:full  # Walks public ATS directories beyond your tracked list
```

### Output

New offers → `data/pipeline.md` (inbox). Each entry has:
- Company, Role, URL, URL, Source, Date discovered, Score (if pre-scored)

---

## Processing the Pipeline

```bash
/career-ops pipeline
# or: node pipeline.mjs
```

**What it does:**
1. Reads `data/pipeline.md`
2. For each unprocessed URL: fetches JD, evaluates, writes report + PDF
3. Moves processed items to `data/applications.md` (via TSV)
4. Leaves `SKIP` items in pipeline for review

### Pipeline Columns

| Column | Meaning |
|--------|---------|
| `✓` | Processed (report + PDF generated) |
| `✗` | Failed (check logs) |
| `→` | Skipped by user |
| `?` | Pending |

---

## Generating PDFs

### For Latest Evaluation

```bash
/career-ops pdf
```

### For Specific Report

```bash
/career-ops pdf reports/042-acme-2025-01-15.md
```

### Cover Letters

```bash
/career-ops cover           # Interactive: 4 angle prompts
/career-ops cover 042-acme  # For specific report
```

**Cover letter flow:**
1. Paste JD or reference report slug
2. Answer 4 prompts: Why this role? What problems? Your approach? Tone?
3. Review draft in chat
4. Generate A4 PDF (same pipeline as CV)

---

## Batch Evaluation

### Via Headless Workers

```bash
# Process N offers in parallel
./batch/batch-runner.sh --limit 10
./batch/batch-runner.sh --resume-paused  # Resume after interruption
```

### Via Codex (Headless)

```bash
codex exec "Run career-ops batch mode for data/pipeline.md --limit 5"
```

### Batch Output

- Reports → `reports/`
- PDFs → `output/`
- Tracker additions → `batch/tracker-additions/`
- Merge with: `node merge-tracker.mjs`

---

## Tracking Applications

### View Status

```bash
/career-ops tracker
```

### Status Lifecycle

```
Evaluated → Applied → Responded → Interview → Offer → (Accept/Reject)
                          ↘ Rejected
                          ↘ Discarded
                          ↘ SKIP
```

### Update Status

```bash
# Edit data/applications.md directly, or use tracker mode interactively
/career-ops tracker
```

### Canonical States (from templates/states.yml)

| State | When |
|-------|------|
| `Evaluated` | Report done, pending decision |
| `Applied` | Application sent |
| `Responded` | Company replied |
| `Interview` | In process |
| `Offer` | Offer received |
| `Rejected` | Company said no |
| `Discarded` | You passed / role closed |
| `SKIP` | Doesn't fit, don't apply |

**Rules:**
- No bold/markdown in status column
- No dates in status (use Date column)
- Notes go in Notes column

---

## Interview Preparation

### Company-Specific Prep

```bash
/career-ops interview-prep Anthropic "Senior AI Engineer"
```

Generates: `interview-prep/anthropic-senior-ai-engineer.md`

**Contents:**
- Company intel (culture, tech stack, interview process)
- Role-specific STAR+R stories from your story bank
- Likely technical + behavioral questions
- Your questions for them
- Comp negotiation anchors

### Time-Blocked Plan

```bash
/career-ops interview/plan Anthropic "Senior AI Engineer" --days 5
```

### Practice Session

```bash
/career-ops interview/practice Anthropic "Senior AI Engineer"
```

### Post-Interview Debrief

```bash
/career-ops interview/debrief Anthropic "Senior AI Engineer"
```

Updates story bank with new STAR+R reflections.

### Story Bank

Accumulates in: `interview-prep/story-bank.md`

**Format per story:**
- Situation, Task, Action, Result, **Reflection** (what you learned)

---

## Negotiation

### Offer Evaluation

```bash
/career-ops oferta "paste offer details"
```

### Compare Offers

```bash
/career-ops ofertas "offer 1 details" "offer 2 details"
```

### Negotiation Scripts (in modes/_shared.md)

Frameworks for:
- **Base salary**: Market data + your anchor
- **Geographic discount pushback**: "Remote-first companies shouldn't penalize location"
- **Competing offer leverage**: "I have X at $Y, can you match?"
- **Equity/refresh**: "What's the refresh policy? 4-year vest?"
- **Sign-on/relocation**: "Standard for this level?"

---

## Maintenance

### Daily

```bash
node verify-pipeline.mjs      # Health check
node normalize-statuses.mjs   # Fix status inconsistencies
```

### Weekly

```bash
node dedup-tracker.mjs        # Remove duplicates
node merge-tracker.mjs        # Merge batch additions
node detect-reposts.mjs       # Flag re-listed roles (90-day window)
node analyze-patterns.mjs     # Rejection patterns, ATS channel analysis
```

### Update System

```bash
node update-system.mjs check   # Check for updates
node update-system.mjs apply   # Apply update (preserves your data)
node update-system.mjs rollback # Rollback if needed
```

### Cleanup

```bash
# Remove old reports/PDFs (keep last 30 days)
find reports -mtime +30 -delete
find output -mtime +30 -delete
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Evaluate offer | `/career-ops "URL or JD"` |
| Scan portals | `/career-ops scan` or `node scan.mjs --verify` |
| Process pipeline | `/career-ops pipeline` |
| Generate CV PDF | `/career-ops pdf` |
| Generate cover letter | `/career-ops cover` |
| Batch evaluate | `./batch/batch-runner.sh --limit 10` |
| View tracker | `/career-ops tracker` |
| Company research | `/career-ops deep Company "Role"` |
| Interview prep | `/career-ops interview-prep Company "Role"` |
| Negotiation help | `/career-ops oferta "offer details"` |
| Check updates | `node update-system.mjs check` |

---

## Pro Tips

1. **Feed the system context** — The more you add to `cv.md`, `article-digest.md`, `modes/_profile.md`, `config/profile.yml`, the better evaluations get.

2. **Trust the score, but verify** — Below 4.0 = don't apply unless you have a specific reason.

3. **Use `--verify` on scan** — Catches ghost jobs before they pollute your pipeline.

4. **Run `merge-tracker.mjs` after every batch** — Prevents duplicate tracker entries.

5. **Customize archetypes in `modes/_profile.md`** — Default is AI/automation; change to your target roles.

6. **Keep `portals.yml` current** — Add/remove companies as your target list evolves.

7. **Story bank compounds** — Every evaluation adds STAR+R stories; interview prep gets stronger over time.

8. **Never auto-submit** — Career-ops generates, you decide. Always review PDF before sending.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Skills not loading (Windows) | `node update-system.mjs apply` |
| PDF not generating | `npx playwright install chromium` |
| Scan returns 0 results | Check `portals.yml` title filters |
| Tracker links broken | `node merge-tracker.mjs --migrate` |
| Rate limited on batch | `./batch/batch-runner.sh --limit 5` |

---

## Getting Help

- **Discord:** https://discord.gg/8pRpHETxa4
- **GitHub Discussions:** https://github.com/santifer/career-ops/discussions
- **Docs:** `docs/` folder (SETUP, CUSTOMIZATION, FAQ, ARCHITECTURE, SCRIPTS, etc.)
- **Issue template:** https://github.com/santifer/career-ops/issues/new/choose

---

*This guide covers the standard piloting workflow. For edge cases, custom integrations, or advanced automation, see [ARCHITECTURE.md](ARCHITECTURE.md) and [SCRIPTS.md](SCRIPTS.md).*