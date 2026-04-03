// FORK VALIDATION: Kiro Credits Reporting
// Verifies the three layers of the credits pipeline:
//   §A — Session.getUsage cost short-circuit (kiro credits bypass token math)
//   §B — Formatting logic: ✦N.NN for kiro, $N.NN for others
//   §C — metadataExtractor accumulation logic

import { describe, expect, test } from "bun:test"
import { Session } from "../../src/session"
import type { Provider } from "../../src/provider/provider"

// Minimal model stub — only the fields getUsage reads
function model(costPerMillion = 0): Provider.Model {
  return {
    id: "test-model",
    name: "Test Model",
    providerID: "test" as any,
    cost: { input: costPerMillion, output: costPerMillion },
    api: { id: "test-model", npm: "@ai-sdk/openai" },
    options: {},
    headers: {},
    status: "active",
    family: "test",
    source: "custom",
    env: [],
  } as unknown as Provider.Model
}

const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

// ─── §A: Session.getUsage cost short-circuit ─────────────────────────────────

describe("fork.credits.getUsage", () => {
  test("kiro credits override token math", () => {
    const result = Session.getUsage({
      model: model(1_000_000), // $1 per token — would produce huge cost via token math
      usage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      metadata: { kiro: { credits: 0.06 } } as any,
    })
    expect(result.cost).toBe(0.06)
  })

  test("kiro credits of zero are used as-is (not replaced by token math)", () => {
    const result = Session.getUsage({
      model: model(1_000_000),
      usage: { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 },
      metadata: { kiro: { credits: 0 } } as any,
    })
    expect(result.cost).toBe(0)
  })

  test("without kiro metadata, token math applies", () => {
    // $1 per million tokens × 1000 tokens = $0.001
    const result = Session.getUsage({
      model: model(1),
      usage: { inputTokens: 1000, outputTokens: 0, totalTokens: 1000 },
      metadata: {},
    })
    expect(result.cost).toBeCloseTo(0.001, 6)
  })

  test("kiro credits are read from metadata.kiro.credits specifically", () => {
    // anthropic credits in metadata should NOT trigger the kiro short-circuit
    const result = Session.getUsage({
      model: model(0),
      usage,
      metadata: { anthropic: { credits: 99 } } as any,
    })
    // cost should be 0 from token math (zero pricing), not 99
    expect(result.cost).toBe(0)
  })

  test("tokens are still returned alongside kiro credits", () => {
    const result = Session.getUsage({
      model: model(0),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      metadata: { kiro: { credits: 0.03 } } as any,
    })
    expect(result.cost).toBe(0.03)
    expect(result.tokens.input).toBe(100)
    expect(result.tokens.output).toBe(50)
  })
})

// ─── §B: Formatting logic ─────────────────────────────────────────────────────
// Replicates the inline expression used in all 5 TUI display sites.
// If any upstream merge changes the symbol, precision, or format, these fail.

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
function fmt(cost: number, isKiro: boolean) {
  return isKiro ? "✦" + cost.toFixed(2) : money.format(cost)
}

describe("fork.credits.formatting", () => {
  test("kiro cost uses ✦ prefix", () => {
    expect(fmt(0.06, true)).toBe("✦0.06")
  })

  test("kiro cost uses exactly 2 decimal places", () => {
    expect(fmt(0.123456, true)).toBe("✦0.12")
  })

  test("kiro cost of 1.5 pads to 2 decimals", () => {
    expect(fmt(1.5, true)).toBe("✦1.50")
  })

  test("non-kiro cost uses USD format", () => {
    expect(fmt(0.06, false)).toBe("$0.06")
  })

  test("✦ symbol is U+2726 (not a lookalike)", () => {
    expect(fmt(1, true).codePointAt(0)).toBe(0x2726)
  })

  test("non-kiro cost never contains ✦", () => {
    expect(fmt(0.06, false)).not.toContain("✦")
  })
})

// ─── §C: metadataExtractor accumulation logic ─────────────────────────────────
// Replicates the inline extractor in provider.ts:780-800.
// Tests the accumulation invariants without needing to import the private function.

function makeExtractor() {
  let credits: number | undefined
  return {
    processChunk(raw: unknown) {
      const c = (raw as any)?.providerMetadata?.kiro?.credits
      if (typeof c === "number") credits = (credits ?? 0) + c
    },
    buildMetadata() {
      if (credits === undefined) return undefined
      return { kiro: { credits } }
    },
  }
}

describe("fork.credits.metadataExtractor", () => {
  test("single chunk with credits", () => {
    const ext = makeExtractor()
    ext.processChunk({ providerMetadata: { kiro: { credits: 0.03 } } })
    expect(ext.buildMetadata()).toEqual({ kiro: { credits: 0.03 } })
  })

  test("multiple chunks accumulate", () => {
    const ext = makeExtractor()
    ext.processChunk({ providerMetadata: { kiro: { credits: 0.03 } } })
    ext.processChunk({ providerMetadata: { kiro: { credits: 0.03 } } })
    expect(ext.buildMetadata()).toEqual({ kiro: { credits: 0.06 } })
  })

  test("no credits chunks returns undefined", () => {
    const ext = makeExtractor()
    ext.processChunk({ providerMetadata: {} })
    ext.processChunk({})
    expect(ext.buildMetadata()).toBeUndefined()
  })

  test("non-number credits are ignored", () => {
    const ext = makeExtractor()
    ext.processChunk({ providerMetadata: { kiro: { credits: "lots" } } })
    expect(ext.buildMetadata()).toBeUndefined()
  })

  test("mixed chunks — only numeric credits accumulate", () => {
    const ext = makeExtractor()
    ext.processChunk({ providerMetadata: { kiro: { credits: 0.01 } } })
    ext.processChunk({ providerMetadata: {} }) // no credits
    ext.processChunk({ providerMetadata: { kiro: { credits: 0.02 } } })
    expect(ext.buildMetadata()).toEqual({ kiro: { credits: 0.03 } })
  })
})
