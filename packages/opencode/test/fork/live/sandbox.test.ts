// FORK VALIDATION (live): §5 Sandbox / Pippin Integration
// Verifies that the running server correctly handles sandbox config.
//
// Requires: OPENCODE_FORK_LIVE_TESTS=1

import { describe, expect, test } from "bun:test"
import { LIVE, startServer } from "./harness"

describe("fork.live.sandbox", () => {
  test.skipIf(!LIVE)("sandbox config can be toggled via PATCH /config", async () => {
    await using srv = await startServer()

    // Enable sandbox
    const enableRes = await fetch(`${srv.url}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandbox: { enabled: true } }),
    })
    expect(enableRes.status).toBe(200)
    const enabled = (await enableRes.json()) as { sandbox?: { enabled?: boolean } }
    expect(enabled.sandbox?.enabled).toBe(true)

    // Disable sandbox
    const disableRes = await fetch(`${srv.url}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandbox: { enabled: false } }),
    })
    expect(disableRes.status).toBe(200)
    const disabled = (await disableRes.json()) as { sandbox?: { enabled?: boolean } }
    expect(disabled.sandbox?.enabled).toBe(false)
  })

  test.skipIf(!LIVE)("PATCH /config sandbox response reflects the patched value", async () => {
    await using srv = await startServer()

    // The PATCH response body contains the patched fields — verify round-trip
    const res = await fetch(`${srv.url}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandbox: { enabled: true } }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { sandbox?: { enabled?: boolean } }
    // The response echoes back the patched config section
    expect(body.sandbox?.enabled).toBe(true)
  })

  test.skipIf(!LIVE)("permission endpoint is reachable and returns an array", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/permission`)
    expect(res.status).toBe(200)
    const list = await res.json()
    expect(Array.isArray(list)).toBe(true)
  })
})
