import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ProviderAuth } from "../../src/provider/auth"
import { Bus } from "../../src/bus"
import { TuiEvent } from "../../src/cli/cmd/tui/event"

describe("plugin.auth-override", () => {
  test("user plugin does not override built-in github-copilot auth", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const pluginDir = path.join(dir, ".opencode", "plugin")
        await fs.mkdir(pluginDir, { recursive: true })

        await Bun.write(
          path.join(pluginDir, "custom-copilot-auth.ts"),
          [
            "export default async () => ({",
            "  auth: {",
            '    provider: "github-copilot",',
            "    methods: [",
            '      { type: "api", label: "Test Override Auth" },',
            "    ],",
            "    loader: async () => ({ access: 'test-token' }),",
            "  },",
            "})",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const methods = await ProviderAuth.methods()
        const copilot = methods["github-copilot"]
        expect(copilot).toBeDefined()
        expect(copilot.length).toBe(1)
        expect(copilot[0].label).toBe("Login with GitHub Copilot")
      },
    })
  }, 30000)

  test("config plugin auth is ignored", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const pluginDir = path.join(dir, "node_modules", "@scope", "plugin")
        await fs.mkdir(pluginDir, { recursive: true })

        await Bun.write(
          path.join(pluginDir, "package.json"),
          JSON.stringify({
            name: "@scope/plugin",
            version: "1.0.0",
            type: "module",
            main: "./index.js",
          }),
        )

        await Bun.write(
          path.join(pluginDir, "index.js"),
          [
            "export default async () => ({",
            "  auth: {",
            '    provider: "blocked-provider",',
            "    methods: [",
            '      { type: "api", label: "Blocked Auth" },',
            "    ],",
            "  },",
            "})",
            "",
          ].join("\n"),
        )

        await Bun.write(
          path.join(dir, "package.json"),
          JSON.stringify({ name: "plugin-fixture", version: "1.0.0", type: "module" }),
        )

        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
            plugin: ["@scope/plugin"],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const methods = await ProviderAuth.methods()
        expect(methods["blocked-provider"]).toBeUndefined()
      },
    })
  })

  test("ignored custom plugins emit warning toast", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            $schema: "https://opencode.ai/config.json",
            plugin: ["@scope/plugin"],
          }),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const events: Array<{ title?: string; message: string; variant: string }> = []
        const unsub = Bus.subscribe(TuiEvent.ToastShow, (evt) => {
          events.push(evt.properties)
        })
        await ProviderAuth.methods()
        unsub()
        expect(events).toHaveLength(1)
        expect(events[0].title).toBe("Plugins ignored")
        expect(events[0].variant).toBe("warning")
      },
    })
  })
})
