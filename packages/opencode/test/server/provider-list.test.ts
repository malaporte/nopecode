import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { Log } from "../../src/util/log"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { ModelsDev } from "../../src/provider/models"
import { tmpdir } from "../fixture/fixture"
Log.init({ print: false })

const data = {
  openai: {
    id: "openai",
    name: "OpenAI",
    env: ["OPENAI_API_KEY"],
    models: {
      "gpt-5.2": {
        id: "gpt-5.2",
        name: "GPT-5.2",
        family: "gpt-5",
        release_date: "2025-01-01",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 128000, output: 8192 },
        options: {},
      },
    },
  },
  "github-copilot": {
    id: "github-copilot",
    name: "GitHub Copilot",
    env: [],
    models: {
      "gpt-5.2-codex": {
        id: "gpt-5.2-codex",
        name: "GPT-5.2 Codex",
        family: "gpt-5",
        release_date: "2025-01-01",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 128000, output: 8192 },
        options: {},
      },
      "grok-code-fast-1": {
        id: "grok-code-fast-1",
        name: "Grok Code Fast 1",
        family: "grok",
        release_date: "2025-01-01",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 128000, output: 8192 },
        options: {},
      },
    },
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    env: ["ANTHROPIC_API_KEY"],
    models: {
      "claude-sonnet-4": {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        family: "claude",
        release_date: "2025-01-01",
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 200000, output: 8192 },
        options: {},
      },
    },
  },
}

afterEach(() => {
  ModelsDev.Data.reset()
  delete process.env.OPENCODE_MODELS_PATH
})

describe("provider.list endpoint", () => {
  test("returns only allowed providers and strips copilot grok models", async () => {
    const saved = process.env["NOPECODE_ALLOW_ALL_PROVIDERS"]
    delete process.env["NOPECODE_ALLOW_ALL_PROVIDERS"]
    try {
      await using tmp = await tmpdir({
        config: {},
        init: async (dir) => {
          const file = path.join(dir, "models.json")
          await Bun.write(file, JSON.stringify(data))
          process.env.OPENCODE_MODELS_PATH = file
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          ModelsDev.Data.reset()
          const app = Server.Default()
          const response = await app.request("/provider")

          expect(response.status).toBe(200)

          const body = await response.json()
          const ids = body.all.map((x: { id: string }) => x.id).sort()
          expect(ids).toEqual(["github-copilot", "openai"])

          const copilot = body.all.find((x: { id: string }) => x.id === "github-copilot")
          expect(copilot).toBeDefined()
          expect(copilot.models["gpt-5.2-codex"]).toBeDefined()
          expect(copilot.models["grok-code-fast-1"]).toBeUndefined()
        },
      })
    } finally {
      if (saved !== undefined) process.env["NOPECODE_ALLOW_ALL_PROVIDERS"] = saved
    }
  })
})
