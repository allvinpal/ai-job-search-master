import { apiFetch, htmlFetch, clean, writeError, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  url: string
  format: "json" | "plain"
}

/** Extract job ID from a Naukri URL. */
function extractJobId(input: string): string | null {
  // Try to extract numeric job ID from URL patterns like:
  // /job-listings-...-123456789  or  jobId=123456789
  const idMatch = input.match(/(\d{8,})/)
  return idMatch ? idMatch[1] : null
}

/** Parse job detail from the HTML page as fallback. */
function parseHtmlDetail(html: string, url: string): JobDetail {
  const titleMatch = html.match(/<h1[^>]*class="[^"]*jd-header-title[^"]*"[^>]*>([^<]+)/i)
    || html.match(/<h1[^>]*>([^<]+)/i)
  const title = titleMatch ? clean(titleMatch[1]) : "(untitled)"

  const companyMatch = html.match(/class="[^"]*jd-header-comp-name[^"]*"[^>]*>\s*(?:<a[^>]*>)?([^<]+)/i)
  const company = companyMatch ? clean(companyMatch[1]) : null

  const locMatch = html.match(/class="[^"]*location[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
  const location = locMatch ? clean(locMatch[1]) : null

  const expMatch = html.match(/class="[^"]*experience[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
  const experience = expMatch ? clean(expMatch[1]) : null

  const salMatch = html.match(/class="[^"]*salary[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
  const salary = salMatch ? clean(salMatch[1]) : null

  const descMatch = html.match(/class="[^"]*job-desc[^"]*"[^>]*>([\s\S]*?)<\/section/i)
    || html.match(/class="[^"]*dang-inner-html[^"]*"[^>]*>([\s\S]*?)<\/div/i)
  const descHtml = descMatch ? descMatch[1] : null
  let description: string | null = null
  if (descHtml) {
    description = descHtml
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
    description = clean(description).replace(/\n{3,}/g, "\n\n").trim() || null
  }

  return {
    id: extractJobId(url) || url,
    title,
    company,
    companyUrl: null,
    location,
    experience,
    salary,
    date: null,
    skills: [],
    url,
    description: description ? description.slice(0, 300) : null,
    fullDescription: description,
    employmentType: null,
    industry: null,
    education: null,
    roleCategory: null,
    isActive: !/expired|closed|no longer accepting/i.test(html.slice(0, 5000)),
  }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const jobId = extractJobId(opts.url)

  try {
    let job: JobDetail | null = null

    // Try API first if we have a job ID
    if (jobId) {
      try {
        const data = await apiFetch(`https://www.naukri.com/jobapi/v3/job/${jobId}`)
        if (data && data.jobDetails) {
          const jd = data.jobDetails
          job = {
            id: jd.jobId || jobId,
            title: jd.title || "(untitled)",
            company: jd.companyName || null,
            companyUrl: jd.companyUrl ? `https://www.naukri.com${jd.companyUrl}` : null,
            location: jd.location || null,
            experience: jd.experience || null,
            salary: jd.salary || null,
            date: jd.createdDate || null,
            skills: (jd.tagsAndSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
            url: opts.url,
            description: jd.jobDescription ? clean(jd.jobDescription) : null,
            fullDescription: jd.jobDescription || null,
            employmentType: jd.employmentType || null,
            industry: jd.industry || null,
            education: jd.education || null,
            roleCategory: jd.roleCategory || null,
            isActive: jd.status !== "Expired" && jd.status !== "Closed",
          }
        }
      } catch {
        // Fall through to HTML
      }
    }

    // Fallback to HTML scraping
    if (!job) {
      const html = await htmlFetch(opts.url)
      if (!html) {
        writeError("Job not found", "NOT_FOUND")
        return 1
      }
      job = parseHtmlDetail(html, opts.url)
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.employmentType ? `Type: ${job.employmentType}` : "",
        job.industry ? `Industry: ${job.industry}` : "",
        job.roleCategory ? `Role: ${job.roleCategory}` : "",
        job.education ? `Education: ${job.education}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        `Status: ${job.isActive ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        "",
        job.description || job.fullDescription || "(no description)",
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
