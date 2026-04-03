// FORK VALIDATION (live): §1 Provider Restrictions + §2 Kiro Provider
// Verifies that the running server only exposes allowed providers and that
// grok models are absent from github-copilot.
//
// Requires: OPENCODE_FORK_LIVE_TESTS=1

import { describe, expect, test } from "bun:test"
import { LIVE, startServer } from "./harness"

const ALLOWED = new Set(["openai", "github-copilot", "kiro"])

describe("fork.live.provider-allowlist", () => {
  test.skipIf(!LIVE)("GET /provider returns only allowed providers", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/provider`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { all: { id: string }[]; connected: string[] }
    for (const p of body.all) {
      expect(ALLOWED.has(p.id)).toBe(true)
    }
  })

  test.skipIf(!LIVE)("kiro appears in connected providers when logged in", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/provider`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { all: { id: string }[]; connected: string[] }
    expect(body.connected).toContain("kiro")
  })

  test.skipIf(!LIVE)("kiro provider has at least one model", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/provider`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { all: { id: string; models: Record<string, unknown> }[] }
    const kiro = body.all.find((p) => p.id === "kiro")
    expect(kiro).toBeDefined()
    expect(Object.keys(kiro!.models).length).toBeGreaterThan(0)
  })

  test.skipIf(!LIVE)("github-copilot has no grok models", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/provider`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { all: { id: string; models: Record<string, unknown> }[] }
    const copilot = body.all.find((p) => p.id === "github-copilot")
    if (!copilot) return // copilot may not be connected
    const grok = Object.keys(copilot.models).filter((id) => id.includes("grok"))
    expect(grok).toHaveLength(0)
  })

  test.skipIf(!LIVE)("anthropic is not in the provider list", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/provider`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { all: { id: string }[] }
    const ids = body.all.map((p) => p.id)
    expect(ids).not.toContain("anthropic")
    expect(ids).not.toContain("google")
    expect(ids).not.toContain("amazon-bedrock")
  })
})
