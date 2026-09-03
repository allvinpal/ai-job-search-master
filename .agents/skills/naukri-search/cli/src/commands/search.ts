import {
  searchViaGoogle,
  buildNaukriUrl,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  experience?: number
  jobage?: number
  remote?: string // "remote" | "hybrid" | "onsite"
  page: number
  limit: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 18).padEnd(18)
    const exp = (c.experience || "—").slice(0, 10).padEnd(10)
    return `${title} ${company} ${loc} ${exp}`
  })
  const header =
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(18) +
    " EXP"
  return [header, "-".repeat(header.length + 10), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let cards = await searchViaGoogle({
      query: opts.query,
      location: opts.location,
      experience: opts.experience,
      jobage: opts.jobage,
      remote: opts.remote,
      limit: opts.limit,
    })

    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    // Also provide the direct Naukri search URL for the user
    const naukriUrl = buildNaukriUrl({
      query: opts.query,
      location: opts.location,
      experience: opts.experience,
      jobage: opts.jobage,
      remote: opts.remote,
    })

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
      if (cards.length > 0) {
        process.stdout.write(`\nDirect Naukri search: ${naukriUrl}\n`)
      }
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.experience || "—"}\n  ${c.description ? c.description.slice(0, 200) : "—"}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
      process.stdout.write(`\nDirect Naukri search: ${naukriUrl}\n`)
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: opts.page,
              query: opts.query || null,
              location: opts.location || null,
              naukriUrl,
            },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
