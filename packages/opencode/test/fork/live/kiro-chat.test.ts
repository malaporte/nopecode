// FORK VALIDATION (live): §2 Kiro Provider — end-to-end chat
// Sends a real prompt to a kiro model and verifies the response comes back
// with providerID === "kiro" and that the session completes successfully.
//
// Requires: OPENCODE_FORK_LIVE_TESTS=1

import { describe, expect, test } from "bun:test"
import { LIVE, startServer } from "./harness"

type MessagePart = { type: string; [key: string]: unknown }
type MessageResponse = {
  info: {
    role: string
    providerID: string
    modelID: string
    cost: number
    time: { created: number; completed?: number }
    finish?: string
  }
  parts: MessagePart[]
}

describe("fork.live.kiro-chat", () => {
  test.skipIf(!LIVE)("kiro model responds to a simple prompt", async () => {
    await using srv = await startServer()

    // Get the first available kiro model
    const provRes = await fetch(`${srv.url}/provider`)
    expect(provRes.status).toBe(200)
    const provBody = (await provRes.json()) as {
      all: { id: string; models: Record<string, unknown> }[]
      connected: string[]
    }
    expect(provBody.connected).toContain("kiro")
    const kiro = provBody.all.find((p) => p.id === "kiro")
    expect(kiro).toBeDefined()
    const modelID = Object.keys(kiro!.models)[0]
    expect(modelID).toBeDefined()

    // Create a session
    const sessRes = await fetch(`${srv.url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(sessRes.status).toBe(200)
    const sess = (await sessRes.json()) as { id: string }
    expect(sess.id).toBeDefined()

    // Send a minimal prompt — the message endpoint streams and returns the
    // completed assistant message as the final JSON object
    const promptRes = await fetch(`${srv.url}/session/${sess.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerID: "kiro",
        modelID,
        parts: [{ type: "text", text: "Reply with exactly the word: PONG" }],
      }),
    })
    expect(promptRes.status).toBe(200)

    // The response body is the completed assistant message
    const msg = (await promptRes.json()) as MessageResponse
    expect(msg.info.providerID).toBe("kiro")
    expect(msg.info.time.completed).toBeDefined()
    expect(msg.info.finish).toBe("stop")

    // Verify there's actual text content in the response
    const text = msg.parts.find((p) => p.type === "text")
    expect(text).toBeDefined()
    expect(String(text!.text ?? "").length).toBeGreaterThan(0)
  })

  test.skipIf(!LIVE)("kiro chat produces a positive credits-based cost", async () => {
    await using srv = await startServer()

    const provRes = await fetch(`${srv.url}/provider`)
    const provBody = (await provRes.json()) as {
      all: { id: string; models: Record<string, unknown> }[]
      connected: string[]
    }
    const kiro = provBody.all.find((p) => p.id === "kiro")!
    const modelID = Object.keys(kiro.models)[0]

    const sessRes = await fetch(`${srv.url}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const sess = (await sessRes.json()) as { id: string }

    const promptRes = await fetch(`${srv.url}/session/${sess.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerID: "kiro",
        modelID,
        parts: [{ type: "text", text: "Reply with exactly the word: PONG" }],
      }),
    })
    const msg = (await promptRes.json()) as MessageResponse

    // Cost must be positive — kiro credits were received and stored
    expect(msg.info.cost).toBeGreaterThan(0)

    // Cost must be credits-scale (small decimal like 0.06), not token-math-scale
    // (which would be much larger for a model with non-zero pricing).
    // This catches if the kiro credits short-circuit in Session.getUsage is removed.
    expect(msg.info.cost).toBeLessThan(10)

    // The ✦ formatting expression must produce the right prefix for this cost
    const formatted = "✦" + msg.info.cost.toFixed(2)
    expect(formatted).toMatch(/^✦\d+\.\d{2}$/)
  })

  test.skipIf(!LIVE)("autoupdate is false by default in running config", async () => {
    await using srv = await startServer()
    const res = await fetch(`${srv.url}/config`)
    expect(res.status).toBe(200)
    const cfg = (await res.json()) as { autoupdate?: boolean | string }
    // Must be undefined or false — never true (the fork default)
    expect(cfg.autoupdate === true).toBe(false)
  })
})
