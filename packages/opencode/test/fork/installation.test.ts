// FORK VALIDATION: Installation URL overrides
// Verifies that all update/install URLs point to the fork repo
// (malaporte/nopecode) and not upstream (anomalyco/opencode).
//
// These are source-text assertions — the URLs are pure string constants and
// the risk of a merge silently reverting them is real (it happened in §5).

import { describe, expect, test } from "bun:test"
import path from "path"

const SRC = path.join(import.meta.dir, "../../src/installation/index.ts")

async function src() {
  return Bun.file(SRC).text()
}

describe("fork.installation", () => {
  test("GitHub releases URL points to malaporte/nopecode", async () => {
    const text = await src()
    expect(text).toContain("malaporte/nopecode/releases/latest")
  })

  test("GitHub releases URL does NOT point to anomalyco/opencode", async () => {
    const text = await src()
    expect(text).not.toContain("anomalyco/opencode/releases/latest")
  })

  test("curl install script URL points to malaporte/nopecode", async () => {
    const text = await src()
    expect(text).toContain("raw.githubusercontent.com/malaporte/nopecode")
  })

  test("curl install script URL does NOT use opencode.ai/install", async () => {
    const text = await src()
    expect(text).not.toContain('"https://opencode.ai/install"')
  })

  test("brew tap command uses malaporte/nopecode", async () => {
    const text = await src()
    // The actual brew tap invocation must reference the fork tap
    expect(text).toContain('"brew", "tap", "malaporte/nopecode"')
  })

  test("brew tap command does NOT use anomalyco/tap as a string literal", async () => {
    const text = await src()
    // anomalyco/tap only appears in comments — not in any string literal
    expect(text).not.toContain('"anomalyco/tap"')
    expect(text).not.toContain("'anomalyco/tap'")
  })
})
