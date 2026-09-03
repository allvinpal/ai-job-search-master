#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Naukri.com — India's largest job portal.
// No external CLI framework, so it runs anywhere `bun` is available with zero install.
//
// Personal use only. Keep volume low. Automated access may be against Naukri's
// Terms of Service. Run it on your own responsibility.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit", e: "experience" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `naukri-cli — search jobs on Naukri.com (India)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>        Keywords (job title, skill, or role). Recommended.
  --location, -l <text>     City or region. e.g. "Bangalore", "Mumbai", "Delhi NCR",
                            "Hyderabad", "Pune", "Remote".
  --experience, -e <years>  Minimum years of experience (e.g. 0, 3, 5, 10).
  --jobage <days>           Posted within N days: 1, 3, 7, 15, 30. Default: all.
  --remote <mode>           remote | hybrid | onsite. Filter by workplace type.
  --page <n>                1-indexed page. Default 1.
  --limit, -n <n>           Cap results emitted. Default 20.
  --format <fmt>            json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "data engineer" -l "Bangalore" --format table
  bun run src/cli.ts search -q "python developer" -l "Hyderabad" -e 3 --jobage 7 --format table
  bun run src/cli.ts search -q "software engineer" --remote remote --format table
  bun run src/cli.ts detail "https://www.naukri.com/job-listings-..." --format plain

Personal use only — keep volume low (Naukri ToS).
`

// Known flags per command (for unknown-flag detection).
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "location", "query", "experience", "jobage", "remote", "page", "limit", "format", "help", "h",
  ]),
  detail: new Set(["format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
        return null
      }
      return val
    }

    if (flags.experience !== undefined) {
      const v = parseIntFlag("experience", flags.experience)
      if (v === null) return 1
      flags.experience = String(v)
    }
    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      flags.jobage = String(v)
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      experience: flags.experience ? parseInt(flags.experience as string, 10) : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      remote: typeof flags.remote === "string" ? flags.remote : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : 20,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const url = (flags._ as string[])[1]
    if (!url) {
      process.stderr.write(JSON.stringify({ error: "detail requires a <url>", code: "NO_URL" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      url,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
