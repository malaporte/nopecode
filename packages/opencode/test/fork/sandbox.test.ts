// FORK VALIDATION: §5 Sandbox / Pippin Integration
// Verifies that:
//   1. The bash tool schema has unsandboxed + unsandboxed_reason params
//   2. agent.ts defaults include unsandboxed_bash: "ask"
//   3. unsandboxed_bash resolves to "ask" even when "*": "allow" is also present
//      (i.e. findLast ordering is correct — the specific entry wins over the wildcard)
//   4. bash.txt contains the # Sandbox section

import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { Permission } from "../../src/permission"
import { evaluate } from "../../src/permission/evaluate"
import BASH_DESCRIPTION from "../../src/tool/bash.txt"

afterEach(async () => {
  await Instance.disposeAll()
})

describe("fork.sandbox", () => {
  test("bash tool schema has unsandboxed boolean param", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { BashTool } = await import("../../src/tool/bash")
        const def = await BashTool.init()
        const shape = (def.parameters as any).shape ?? (def.parameters as any)._def?.shape?.()
        expect(shape).toBeDefined()
        expect(shape.unsandboxed).toBeDefined()
        expect(shape.unsandboxed_reason).toBeDefined()
      },
    })
  })

  test("agent build defaults include unsandboxed_bash: ask", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const agents = await Agent.list()
        const build = agents.find((a) => a.name === "build")
        expect(build).toBeDefined()
        const rule = evaluate("unsandboxed_bash", "*", build!.permission)
        expect(rule.action).toBe("ask")
      },
    })
  })

  test("unsandboxed_bash: ask wins over *: allow (findLast ordering)", () => {
    // This is the critical ordering invariant from DIFFERENCES.md §5.
    // The wildcard "*": "allow" must NOT override the specific "unsandboxed_bash": "ask"
    // entry that comes after it in the ruleset.
    const ruleset = Permission.fromConfig({
      "*": "allow",
      unsandboxed_bash: "ask",
    })
    const rule = evaluate("unsandboxed_bash", "*", ruleset)
    expect(rule.action).toBe("ask")
  })

  test("if unsandboxed_bash entry is removed, wildcard would allow it (confirms the risk)", () => {
    // Demonstrates what would happen if the unsandboxed_bash entry were lost:
    // the wildcard "*": "allow" would silently auto-approve all unsandboxed requests.
    const ruleset = Permission.fromConfig({
      "*": "allow",
      // unsandboxed_bash intentionally omitted
    })
    const rule = evaluate("unsandboxed_bash", "*", ruleset)
    expect(rule.action).toBe("allow") // this is the dangerous state we must avoid
  })

  test("bash.txt contains the # Sandbox section", () => {
    expect(BASH_DESCRIPTION).toContain("# Sandbox")
  })

  test("bash.txt sandbox section explains unsandboxed param", () => {
    expect(BASH_DESCRIPTION).toContain("unsandboxed: true")
  })
})

describe("fork.sandbox.description-substitutions", () => {
  // DIFFERENCES.md §5 calls out that upstream's Effect refactor dropped three
  // of the six replaceAll substitutions (${os}, ${shell}, ${chaining}).
  // These tests catch that regression on every future merge touching bash.ts.

  test("bash.txt contains all six substitution placeholders", () => {
    expect(BASH_DESCRIPTION).toContain("${directory}")
    expect(BASH_DESCRIPTION).toContain("${os}")
    expect(BASH_DESCRIPTION).toContain("${shell}")
    expect(BASH_DESCRIPTION).toContain("${chaining}")
    expect(BASH_DESCRIPTION).toContain("${maxLines}")
    expect(BASH_DESCRIPTION).toContain("${maxBytes}")
  })

  test("built description has no unreplaced ${...} placeholders", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const { BashTool } = await import("../../src/tool/bash")
        const def = await BashTool.init()
        // If any replaceAll call was dropped, the raw ${...} token remains
        expect(def.description).not.toMatch(/\$\{[^}]+\}/)
      },
    })
  })
})
