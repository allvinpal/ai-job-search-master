#!/usr/bin/env bun
// Tiny Bun HTTP server that proxies search/detail requests to the Naukri CLI
// and serves the web UI. Runs on port 3456 by default.
//
// Usage: bun run ui/server.ts
// Then open http://localhost:3456 in your browser.

import { readFileSync } from "fs"
import { resolve, dirname } from "path"

const PORT = parseInt(process.env.PORT || "3456", 10)

// Resolve paths - handle both Unix and Windows
function getFilePath(importUrl: string): string {
  let p = new URL(importUrl).pathname
  // Windows: strip leading / from /C:/...
  if (process.platform === "win32" && /^\/[A-Z]:/.test(p)) p = p.slice(1)
  return p
}

const UI_DIR = dirname(getFilePath(import.meta.url))
const CLI_PATH = resolve(UI_DIR, "../cli/src/cli.ts")

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // API: /api/search?q=...&l=...&experience=...&jobage=...&remote=...&page=...&limit=...
    if (url.pathname === "/api/search") {
      const args = ["search"]
      const q = url.searchParams.get("q")
      const l = url.searchParams.get("l")
      const exp = url.searchParams.get("experience")
      const jobage = url.searchParams.get("jobage")
      const remote = url.searchParams.get("remote")
      const page = url.searchParams.get("page")
      const limit = url.searchParams.get("limit")

      if (q) args.push("-q", q)
      if (l) args.push("-l", l)
      if (exp) args.push("--experience", exp)
      if (jobage) args.push("--jobage", jobage)
      if (remote) args.push("--remote", remote)
      if (page) args.push("--page", page)
      if (limit) args.push("--limit", limit || "20")
      args.push("--format", "json")

      try {
        const { runSearch } = await import("../cli/src/commands/search.js")
        let output = ""
        const originalStdoutWrite = process.stdout.write
        const originalStderrWrite = process.stderr.write

        process.stdout.write = ((chunk: any) => {
          output += typeof chunk === "string" ? chunk : chunk.toString()
          return true
        }) as any

        let errOutput = ""
        process.stderr.write = ((chunk: any) => {
          errOutput += typeof chunk === "string" ? chunk : chunk.toString()
          return true
        }) as any

        let exitCode = 0
        try {
          exitCode = await runSearch({
            query: q || undefined,
            location: l || undefined,
            experience: exp ? parseInt(exp, 10) : undefined,
            jobage: jobage ? parseInt(jobage, 10) : undefined,
            remote: remote || undefined,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            format: "json",
          })
        } finally {
          process.stdout.write = originalStdoutWrite
          process.stderr.write = originalStderrWrite
        }

        if (exitCode !== 0) {
          return new Response(
            errOutput || JSON.stringify({ error: "Search failed", code: "CLI_ERROR" }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
          )
        }
        return new Response(output, {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: e.message, code: "SERVER_ERROR" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }
    }

    // API: /api/detail?url=...
    if (url.pathname === "/api/detail") {
      const jobUrl = url.searchParams.get("url")
      if (!jobUrl) {
        return new Response(
          JSON.stringify({ error: "url parameter required", code: "NO_URL" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }

      try {
        const proc = Bun.spawn(
          ["bun", "run", CLI_PATH, "detail", jobUrl, "--format", "json"],
          { stdout: "pipe", stderr: "pipe", cwd: resolve(UI_DIR, "..") },
        )
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        if (exitCode !== 0) {
          return new Response(
            stderr || JSON.stringify({ error: "Detail fetch failed", code: "CLI_ERROR" }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
          )
        }
        return new Response(stdout, {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        })
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: e.message, code: "SERVER_ERROR" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        )
      }
    }

    // Serve static UI
    if (url.pathname === "/" || url.pathname === "/index.html") {
      try {
        const html = readFileSync(resolve(UI_DIR, "index.html"), "utf-8")
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
        })
      } catch {
        return new Response("UI file not found", { status: 404 })
      }
    }

    return new Response("Not found", { status: 404 })
  },
})

console.log(`
╔══════════════════════════════════════════════════╗
║   🔍 Naukri Job Search UI                        ║
║   Running on http://localhost:${PORT}               ║
║   Press Ctrl+C to stop                           ║
╚══════════════════════════════════════════════════╝
`)
