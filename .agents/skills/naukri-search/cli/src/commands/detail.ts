import { htmlFetch, clean, parseHtmlJobDetail, writeError, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  url: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const html = await htmlFetch(opts.url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }

    const job = parseHtmlJobDetail(html, opts.url)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.employmentType ? `Type: ${job.employmentType}` : "",
        job.industry ? `Industry: ${job.industry}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        `Status: ${job.isActive ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        "",
        job.description || job.fullDescription || "(description not available — Naukri loads job details via client-side JavaScript; open the URL in a browser for the full listing)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
