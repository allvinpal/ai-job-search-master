---
name: naukri-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in India, find
  Indian job listings, or look up a specific job posting on Naukri.com — even
  if they don't mention naukri.com explicitly. Invoke for open positions,
  vacancies, and hiring across any sector or role in Indian cities and metros.
  Trigger phrases: naukri, naukri.com, jobs india, find job india, indian jobs,
  job search india, IT jobs india, developer jobs bangalore, data engineer
  hyderabad, jobs mumbai, jobs delhi, jobs pune, software jobs india, fresher
  jobs, experienced jobs india, remote jobs india, "are there any X jobs in
  <Indian city>", look up this naukri job posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/naukri-search/cli/src/cli.ts *)
---

# Naukri.com Search Skill

Search live job listings from Naukri.com — India's largest job portal. No
authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`.

> **Personal use only.** This scrapes Naukri.com's public job pages; automated
> access may be against Naukri's Terms of Service. Keep volume low, don't use
> it commercially or for bulk data collection, and run it on your own
> responsibility.

## When to use this skill

- Search for job openings across India (any city or remote)
- Filter by experience level, recency, or workplace type (remote/hybrid/onsite)
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/naukri-search/cli/src/cli.ts search --query "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--location <text>` / `-l <text>` — city or region, e.g. `"Bangalore"`, `"Mumbai"`, `"Delhi NCR"`, `"Hyderabad"`, `"Remote"`.
- `--experience <years>` / `-e <years>` — minimum years of experience (e.g. `0`, `3`, `5`, `10`).
- `--jobage <days>` — posted within N days: `1`, `3`, `7`, `15`, `30`. Default: all.
- `--remote <mode>` — `remote`, `hybrid`, or `onsite` (workplace-type filter).
- `--page <n>` — page number (1-indexed). Default 1.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/naukri-search/cli/src/cli.ts detail <url> [--format json|plain]
```

Pass a Naukri job URL (e.g. `https://www.naukri.com/job-listings-...`). Returns the
full description, company, experience, salary, skills, and more.

## Usage examples

```bash
# Data engineer roles in Bangalore
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "data engineer" -l "Bangalore" --format table

# Python developer roles in Hyderabad, 3+ years experience
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "python developer" -l "Hyderabad" -e 3 --format table

# Remote software roles posted in last 7 days
bun run .agents/skills/naukri-search/cli/src/cli.ts search -q "software engineer" --remote remote --jobage 7 --format table

# Full details for a specific job
bun run .agents/skills/naukri-search/cli/src/cli.ts detail "https://www.naukri.com/job-listings-senior-data-engineer-..." --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing URLs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data is from Naukri.com's public job listing pages — no credentials required.
- Naukri may rate-limit or block; the CLI retries 429/5xx with exponential backoff. Keep volume low.
- Job URLs are the primary identifier — pass them as-is to `detail`.
