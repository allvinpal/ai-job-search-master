import {
  apiFetch,
  buildSearchUrl,
  parseApiResults,
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
    const title = (c.title || "").slice(0, 38).padEnd(38)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 18).padEnd(18)
    const exp = (c.experience || "—").slice(0, 10).padEnd(10)
    const salary = (c.salary || "—").slice(0, 16).padEnd(16)
    const skills = (c.skills || []).slice(0, 3).join(", ").slice(0, 30)
    return `${title} ${company} ${loc} ${exp} ${salary} ${skills}`
  })
  const header =
    "TITLE".padEnd(38) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(18) +
    " " +
    "EXP".padEnd(10) +
    " " +
    "SALARY".padEnd(16) +
    " SKILLS"
  return [header, "-".repeat(header.length + 10), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const url = buildSearchUrl({
      query: opts.query,
      location: opts.location,
      experience: opts.experience,
      jobage: opts.jobage,
      remote: opts.remote,
      page: opts.page,
      limit: opts.limit,
    })

    const data = await apiFetch(url)
    let cards = parseApiResults(data)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.experience || "—"} · ${c.salary || "Not disclosed"}\n  Skills: ${c.skills.join(", ") || "—"}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: cards.length,
              page: opts.page,
              query: opts.query || null,
              location: opts.location || null,
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
