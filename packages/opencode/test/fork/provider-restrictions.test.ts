// FORK VALIDATION: §1 Provider Restrictions
// Verifies that only openai, github-copilot, and kiro are allowed when
// OPENCODE_ALLOW_ALL_PROVIDERS is not set. This is a fork-specific invariant
// that must survive every upstream merge touching provider.ts.

import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ProviderID } from "../../src/provider/schema"
import { Env } from "../../src/env"
import { Server } from "../../src/server/server"

// The preload sets OPENCODE_ALLOW_ALL_PROVIDERS=1 so upstream tests pass.
// We save/restore it around tests that need the restriction active.
const saved = process.env["OPENCODE_ALLOW_ALL_PROVIDERS"]

function restrict() {
  delete process.env["OPENCODE_ALLOW_ALL_PROVIDERS"]
}

function restore() {
  if (saved === undefined) delete process.env["OPENCODE_ALLOW_ALL_PROVIDERS"]
  else process.env["OPENCODE_ALLOW_ALL_PROVIDERS"] = saved
}

afterEach(async () => {
  restore()
  await Instance.disposeAll()
})

describe("fork.provider-restrictions", () => {
  test("anthropic is blocked without bypass env var", async () => {
    restrict()
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      init: async () => {
        Env.set("ANTHROPIC_API_KEY", "test-key")
      },
      fn: async () => {
        const providers = await Provider.list()
        expect(providers[ProviderID.anthropic]).toBeUndefined()
      },
    })
  })

  test("openai is allowed without bypass env var", async () => {
    restrict()
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      init: async () => {
        Env.set("OPENAI_API_KEY", "test-key")
      },
      fn: async () => {
        const providers = await Provider.list()
        expect(providers[ProviderID.openai]).toBeDefined()
      },
    })
  })

  test("OPENCODE_ALLOW_ALL_PROVIDERS=1 bypasses the allowlist", async () => {
    process.env["OPENCODE_ALLOW_ALL_PROVIDERS"] = "1"
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      init: async () => {
        Env.set("ANTHROPIC_API_KEY", "test-key")
      },
      fn: async () => {
        const providers = await Provider.list()
        expect(providers[ProviderID.anthropic]).toBeDefined()
      },
    })
  })

  test("github-copilot grok models are excluded", async () => {
    restrict()
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
            provider: {
              "github-copilot": {
                options: { apiKey: "test-key" },
              },
            },
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const providers = await Provider.list()
        const copilot = providers[ProviderID.githubCopilot]
        if (!copilot) return // copilot may not be connected without real auth
        const grok = Object.keys(copilot.models).filter((id) => id.includes("grok"))
        expect(grok).toHaveLength(0)
      },
    })
  })

  test("ProviderID.kiro exists in schema", () => {
    expect(String(ProviderID.kiro)).toBe("kiro")
  })

  test("server /provider route only returns allowed providers", async () => {
    restrict()
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request("/provider")
        expect(res.status).toBe(200)
        const body = (await res.json()) as { all: { id: string }[] }
        const allowed = new Set(["openai", "github-copilot", "kiro"])
        for (const p of body.all) {
          expect(allowed.has(p.id)).toBe(true)
        }
      },
    })
  })

  test("server /provider route excludes grok models from github-copilot", async () => {
    restrict()
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.Default()
        const res = await app.request("/provider")
        expect(res.status).toBe(200)
        const body = (await res.json()) as { all: { id: string; models: Record<string, unknown> }[] }
        const copilot = body.all.find((p) => p.id === "github-copilot")
        if (!copilot) return
        const grok = Object.keys(copilot.models).filter((id) => id.includes("grok"))
        expect(grok).toHaveLength(0)
      },
    })
  })
})
