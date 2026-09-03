// Data source: Naukri.com public job listing pages + internal jobapi/v3 endpoint.
// No authentication required. The internal API returns clean JSON; HTML fallback
// uses regex parsing on the public pages.
//
// Personal use only. Keep volume low.

export const SEARCH_API =
  "https://www.naukri.com/jobapi/v3/search"
export const JOB_DETAIL_API =
  "https://www.naukri.com/jobapi/v3/job"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

/** Common headers for Naukri's internal API. */
function apiHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    appid: "109",
    systemid: "Naukri",
    "Content-Type": "application/json",
    gid: "LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE",
    "X-Requested-With": "XMLHttpRequest",
  }
}

/** Fetch JSON from Naukri's internal API with exponential backoff on 429/5xx. */
export async function apiFetch(url: string): Promise<any> {
  const maxRetries = 4
  let delay = 800
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: apiHeaders(),
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`)
        }
        const jitter = Math.floor(Math.random() * 500)
        await new Promise((r) => setTimeout(r, delay + jitter))
        delay = Math.min(delay * 2, 8000)
        continue
      }
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      return response.json()
    } catch (e: any) {
      if (attempt === maxRetries) throw e
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
    }
  }
  throw new Error("Request failed after max retries")
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 4
  let delay = 800
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
      if (response.status === 429 || response.status >= 500) {
        if (attempt === maxRetries) {
          throw new Error(`Request failed: ${response.status} ${response.statusText}`)
        }
        const jitter = Math.floor(Math.random() * 500)
        await new Promise((r) => setTimeout(r, delay + jitter))
        delay = Math.min(delay * 2, 8000)
        continue
      }
      if (response.status === 404) return ""
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      return response.text()
    } catch (e: any) {
      if (attempt === maxRetries) throw e
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
    }
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  companyUrl: string | null
  location: string | null
  experience: string | null
  salary: string | null
  date: string | null
  skills: string[]
  url: string
  description: string | null
}

export interface JobDetail extends JobCard {
  fullDescription: string | null
  employmentType: string | null
  industry: string | null
  education: string | null
  roleCategory: string | null
  isActive: boolean
}

/**
 * Build the Naukri API search URL from options.
 */
export function buildSearchUrl(opts: {
  query?: string
  location?: string
  experience?: number
  jobage?: number
  remote?: string
  page: number
  limit: number
}): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("keyword", opts.query)
  if (opts.location) params.set("location", opts.location)
  if (opts.experience !== undefined) params.set("experience", String(opts.experience))
  if (opts.jobage) params.set("jobAge", String(opts.jobage))
  // wfhType: 2=WFH/remote, 3=hybrid, 1=WFO/onsite
  const wfh = workTypeFlag(opts.remote)
  if (wfh) params.set("wfhType", wfh)
  params.set("noOfResults", String(opts.limit))
  params.set("urlType", "search_by_keyword")
  params.set("searchType", "adv")
  params.set("pageNo", String(opts.page))
  return `${SEARCH_API}?${params.toString()}`
}

/**
 * Build a descriptive search URL for HTML fallback.
 */
export function buildDescriptiveUrl(opts: {
  query?: string
  location?: string
  page: number
}): string {
  const keyword = (opts.query || "").toLowerCase().replace(/\s+/g, "-")
  const location = (opts.location || "").toLowerCase().replace(/\s+/g, "-")
  let url = "https://www.naukri.com/"
  if (keyword && location) {
    url += `${keyword}-jobs-in-${location}`
  } else if (keyword) {
    url += `${keyword}-jobs`
  } else if (location) {
    url += `jobs-in-${location}`
  } else {
    url += "jobs"
  }
  if (opts.page > 1) url += `-${opts.page}`
  return url
}

/** Workplace-type flag: on-site=1, remote=2, hybrid=3. */
export function workTypeFlag(mode: string | undefined): string | null {
  switch ((mode || "").toLowerCase()) {
    case "remote":
    case "wfh":
      return "2"
    case "hybrid":
      return "3"
    case "onsite":
    case "wfo":
    case "on-site":
      return "1"
    default:
      return null
  }
}

/** Parse Naukri API JSON response into JobCards. */
export function parseApiResults(data: any): JobCard[] {
  if (!data || !data.jobDetails) return []
  const results: JobCard[] = []
  for (const job of data.jobDetails) {
    results.push({
      id: job.jobId || "",
      title: job.title || "(untitled)",
      company: job.companyName || null,
      companyUrl: job.companyUrl ? `https://www.naukri.com${job.companyUrl}` : null,
      location: job.placeholders?.find((p: any) => p.type === "location")?.label || job.ambiguityMessage || null,
      experience: job.placeholders?.find((p: any) => p.type === "experience")?.label || null,
      salary: job.placeholders?.find((p: any) => p.type === "salary")?.label || null,
      date: job.createdDate || job.footerPlaceholderLabel || null,
      skills: (job.tagsAndSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      url: job.jdURL ? `https://www.naukri.com${job.jdURL}` : "",
      description: job.jobDescription || null,
    })
  }
  return results
}

/** Parse the HTML job listing page as fallback. */
export function parseHtmlJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  // Naukri renders job cards in <article> or <div> elements with class containing "jobTuple" or srp-jobtuple
  const cardPattern = /class="[^"]*(?:jobTuple|srp-jobtuple|cust-job-tuple)[^"]*"[\s\S]*?(?=class="[^"]*(?:jobTuple|srp-jobtuple|cust-job-tuple)[^"]*"|$)/gi
  const chunks = html.match(cardPattern) || []

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/class="[^"]*title[^"]*"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)/i)
    if (!titleMatch) continue

    const url = titleMatch[1]
    const title = decodeHtmlEntities(titleMatch[2].trim())
    const id = url.match(/(\d{10,})/)?.[1] || url

    const companyMatch = chunk.match(/class="[^"]*comp-name[^"]*"[^>]*>([^<]+)/i)
    const company = companyMatch ? decodeHtmlEntities(companyMatch[1].trim()) : null

    const locMatch = chunk.match(/class="[^"]*loc[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
    const location = locMatch ? decodeHtmlEntities(locMatch[1].trim()) : null

    const expMatch = chunk.match(/class="[^"]*exp[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
    const experience = expMatch ? decodeHtmlEntities(expMatch[1].trim()) : null

    const salMatch = chunk.match(/class="[^"]*sal[^"]*"[^>]*>\s*(?:<[^>]*>)*\s*([^<]+)/i)
    const salary = salMatch ? decodeHtmlEntities(salMatch[1].trim()) : null

    results.push({
      id,
      title,
      company,
      companyUrl: null,
      location,
      experience,
      salary,
      date: null,
      skills: [],
      url: url.startsWith("http") ? url : `https://www.naukri.com${url}`,
      description: null,
    })
  }

  return results
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Parse a Naukri job detail page (API JSON response). */
export function parseApiJobDetail(data: any): JobDetail {
  if (!data || !data.jobDetails) {
    return {
      id: "",
      title: "(untitled)",
      company: null,
      companyUrl: null,
      location: null,
      experience: null,
      salary: null,
      date: null,
      skills: [],
      url: "",
      description: null,
      fullDescription: null,
      employmentType: null,
      industry: null,
      education: null,
      roleCategory: null,
      isActive: false,
    }
  }
  const job = data.jobDetails
  return {
    id: job.jobId || "",
    title: job.title || "(untitled)",
    company: job.companyName || null,
    companyUrl: job.companyUrl ? `https://www.naukri.com${job.companyUrl}` : null,
    location: job.location || null,
    experience: job.experience || null,
    salary: job.salary || null,
    date: job.createdDate || null,
    skills: (job.tagsAndSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    url: job.jdURL ? `https://www.naukri.com${job.jdURL}` : "",
    description: job.jobDescription ? clean(job.jobDescription) : null,
    fullDescription: job.jobDescription || null,
    employmentType: job.employmentType || null,
    industry: job.industry || null,
    education: job.education || null,
    roleCategory: job.roleCategory || null,
    isActive: job.status !== "Expired" && job.status !== "Closed",
  }
}
