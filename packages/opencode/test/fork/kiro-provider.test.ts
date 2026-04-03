// FORK VALIDATION: §2 Kiro Provider internals
// Tests the exported functions from plugin/kiro.ts and the kiro model
// injection into the provider database.

import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ProviderID } from "../../src/provider/schema"
import { canThink, loadModels, KIRO_MODELS } from "../../src/plugin/kiro"

afterEach(async () => {
  await Instance.disposeAll()
})

// ─── canThink ────────────────────────────────────────────────────────────────

describe("fork.kiro.canThink", () => {
  test("returns true for sonnet models", () => {
    expect(canThink("claude-sonnet-4-6", "Claude Sonnet 4.6")).toBe(true)
    expect(canThink("claude-sonnet-4-5", "Claude Sonnet 4.5")).toBe(true)
  })

  test("returns true for opus models", () => {
    expect(canThink("claude-opus-4-6", "Claude Opus 4.6")).toBe(true)
    expect(canThink("claude-opus-4-5", "Claude Opus 4.5")).toBe(true)
  })

  test("returns false for haiku models", () => {
    expect(canThink("claude-haiku-4-5", "Claude Haiku 4.5")).toBe(false)
  })

  test("returns false for qwen models", () => {
    expect(canThink("qwen3-coder-480b", "Qwen3 Coder 480B")).toBe(false)
  })

  test("is case-insensitive", () => {
    expect(canThink("CLAUDE-SONNET-4-6", "CLAUDE SONNET 4.6")).toBe(true)
  })
})

// ─── KIRO_MODELS fallback ─────────────────────────────────────────────────────

describe("fork.kiro.loadModels", () => {
  test("falls back to KIRO_MODELS when no auth is stored", async () => {
    await using tmp = await tmpdir()
    const result = await loadModels(tmp.path)
    expect(result).toEqual(KIRO_MODELS)
  })

  test("KIRO_MODELS contains at least one sonnet model", () => {
    const ids = Object.keys(KIRO_MODELS)
    expect(ids.some((id) => id.includes("sonnet"))).toBe(true)
  })

  test("KIRO_MODELS entries have required fields", () => {
    for (const [, m] of Object.entries(KIRO_MODELS)) {
      expect(typeof m.name).toBe("string")
      expect(typeof m.context).toBe("number")
      expect(typeof m.input).toBe("number")
      expect(typeof m.output).toBe("number")
      expect(m.context).toBeGreaterThan(0)
    }
  })
})

// ─── Provider database injection ─────────────────────────────────────────────

describe("fork.kiro.provider-database", () => {
  test("Provider.db() is exported and returns an object", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        expect(typeof db).toBe("object")
        expect(db).not.toBeNull()
      },
    })
  })

  test("kiro provider is injected into the database", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        expect(db[ProviderID.kiro]).toBeDefined()
      },
    })
  })

  test("kiro models have zero cost (credits-based, not token-priced)", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        const kiro = db[ProviderID.kiro]
        expect(kiro).toBeDefined()
        for (const model of Object.values(kiro!.models)) {
          expect(model.cost?.input).toBe(0)
          expect(model.cost?.output).toBe(0)
        }
      },
    })
  })

  test("kiro sonnet models have capabilities.reasoning: true", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        const kiro = db[ProviderID.kiro]
        expect(kiro).toBeDefined()
        const sonnet = Object.values(kiro!.models).find((m) => m.id.includes("sonnet"))
        expect(sonnet).toBeDefined()
        expect(sonnet!.capabilities.reasoning).toBe(true)
      },
    })
  })

  test("kiro haiku/qwen models do NOT have capabilities.reasoning: true", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        const kiro = db[ProviderID.kiro]
        expect(kiro).toBeDefined()
        const nonThinking = Object.values(kiro!.models).filter(
          (m) => !m.id.includes("sonnet") && !m.id.includes("opus"),
        )
        for (const m of nonThinking) {
          expect(m.capabilities.reasoning).toBe(false)
        }
      },
    })
  })

  test("kiro sonnet models have a thinking variant", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const db = await Provider.db()
        const kiro = db[ProviderID.kiro]
        const sonnet = Object.values(kiro!.models).find((m) => m.id.includes("sonnet"))
        expect(sonnet).toBeDefined()
        expect(Object.keys(sonnet!.variants ?? {})).toContain("thinking")
      },
    })
  })
})
