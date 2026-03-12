import { test, expect } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { Env } from "../../src/env"
import { Auth } from "../../src/auth"

async function project(
  input: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
  },
) {
  return tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "opencode.json"), JSON.stringify(input))
    },
  })
}

test("openai provider loads from env variable", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-openai-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["openai"]).toBeDefined()
      expect(providers["openai"].source).toBe("env")
    },
  })
})

test("github-copilot provider loads from oauth auth", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      await Auth.set("github-copilot", {
        type: "oauth",
        access: "access",
        refresh: "refresh",
        expires: Date.now() + 60_000,
      })
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["github-copilot"]).toBeDefined()
    },
  })
})

test("disabled_providers excludes allowed provider", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    disabled_providers: ["openai"],
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-openai-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["openai"]).toBeUndefined()
    },
  })
})

test("enabled_providers narrows within branch allowlist", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    enabled_providers: ["openai"],
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-openai-key")
      await Auth.set("github-copilot", {
        type: "oauth",
        access: "access",
        refresh: "refresh",
        expires: Date.now() + 60_000,
      })
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["openai"]).toBeDefined()
      expect(providers["github-copilot"]).toBeUndefined()
    },
  })
})

test("blocked provider from env is ignored", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "test-api-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["anthropic"]).toBeUndefined()
    },
  })
})

test("blocked provider from config is ignored", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    provider: {
      anthropic: {
        options: {
          apiKey: "config-api-key",
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["anthropic"]).toBeUndefined()
    },
  })
})

test("custom provider from config is ignored", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    provider: {
      "custom-provider": {
        name: "Custom Provider",
        npm: "@ai-sdk/openai-compatible",
        api: "https://api.custom.com/v1",
        env: ["CUSTOM_API_KEY"],
        models: {
          "custom-model": {
            name: "Custom Model",
            tool_call: true,
            limit: {
              context: 128000,
              output: 4096,
            },
          },
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["custom-provider"]).toBeUndefined()
    },
  })
})

test("openai model filters still work", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    provider: {
      openai: {
        whitelist: ["gpt-5.2"],
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-openai-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["openai"]).toBeDefined()
      expect(Object.keys(providers["openai"].models)).toEqual(["gpt-5.2"])
    },
  })
})

test("env variable takes precedence and config merges options for openai", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    provider: {
      openai: {
        options: {
          timeout: 60000,
          chunkTimeout: 15000,
        },
      },
    },
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "env-api-key")
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["openai"]).toBeDefined()
      expect(providers["openai"].options.timeout).toBe(60000)
      expect(providers["openai"].options.chunkTimeout).toBe(15000)
    },
  })
})

test("getModel returns non-gpt openai model", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-api-key")
    },
    fn: async () => {
      const model = await Provider.getModel("openai", "o3-mini")
      expect(model.providerID).toBe("openai")
      expect(model.id).toBe("o3-mini")
    },
  })
})

test("github-copilot filters grok models", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      await Auth.set("github-copilot", {
        type: "oauth",
        access: "access",
        refresh: "refresh",
        expires: Date.now() + 60_000,
      })
    },
    fn: async () => {
      const providers = await Provider.list()
      expect(providers["github-copilot"]).toBeDefined()
      expect(providers["github-copilot"].models["grok-code-fast-1"]).toBeUndefined()
      expect(providers["github-copilot"].models["gpt-5.2-codex"]).toBeDefined()
    },
  })
})

test("getModel throws for blocked provider", async () => {
  await using tmp = await project()
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "test-api-key")
    },
    fn: async () => {
      expect(Provider.getModel("anthropic", "claude-sonnet-4-20250514")).rejects.toThrow()
    },
  })
})

test("parseModel correctly parses provider/model string", () => {
  const result = Provider.parseModel("openai/gpt-5.2")
  expect(result.providerID).toBe("openai")
  expect(result.modelID).toBe("gpt-5.2")
})

test("parseModel handles model IDs with slashes", () => {
  const result = Provider.parseModel("openrouter/anthropic/claude-3-opus")
  expect(result.providerID).toBe("openrouter")
  expect(result.modelID).toBe("anthropic/claude-3-opus")
})

test("defaultModel respects config model setting", async () => {
  await using tmp = await project({
    $schema: "https://opencode.ai/config.json",
    model: "openai/gpt-5.2",
  })
  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("OPENAI_API_KEY", "test-api-key")
    },
    fn: async () => {
      const model = await Provider.defaultModel()
      expect(model.providerID).toBe("openai")
      expect(model.modelID).toBe("gpt-5.2")
    },
  })
})
