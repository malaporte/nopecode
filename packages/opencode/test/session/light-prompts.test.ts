import { describe, expect, test } from "bun:test"
import { ProviderID } from "../../src/provider/schema"
import { SystemPrompt } from "../../src/session/system"

describe("session light prompts", () => {
  test("uses compact OpenAI prompt in light mode", () => {
    const model = {
      id: "gpt-5",
      name: "GPT-5",
      providerID: ProviderID.openai,
      api: { id: "gpt-5" },
    } as any

    const full = SystemPrompt.provider(model, false)[0]
    const light = SystemPrompt.provider(model, true)[0]

    expect(light.length).toBeLessThan(full.length)
    expect(light).not.toContain("## Frontend tasks")
    expect(light).toContain("Default to doing the work with minimal overhead")
  })
})
