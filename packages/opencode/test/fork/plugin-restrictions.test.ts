// FORK VALIDATION: §3 Custom Plugins Disabled
// Verifies that npm/custom plugin loading is disabled, internal plugins
// (including NotifyPlugin) still load, and a toast warning fires when
// a user has plugins configured.

import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Plugin } from "../../src/plugin"
import { Bus } from "../../src/bus"
import { TuiEvent } from "../../src/cli/cmd/tui/event"
import { Filesystem } from "../../src/util/filesystem"

const saved = process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]

afterEach(async () => {
  if (saved === undefined) delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
  else process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"] = saved
  await Instance.disposeAll()
})

describe("fork.plugin-restrictions", () => {
  test("internal plugins load even when custom plugins are configured", async () => {
    // Re-enable default plugins so internal ones (NotifyPlugin etc.) load
    delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            plugin: ["file:///tmp/nonexistent-custom-plugin.ts"],
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hooks = await Plugin.list()
        // Internal plugins (NotifyPlugin, auth plugins) should still be loaded
        expect(hooks.length).toBeGreaterThan(0)
      },
    })
  })

  test("custom plugins are silently ignored — hook count unchanged", async () => {
    delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]

    // Baseline: no custom plugins configured
    await using base = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(path.join(dir, "opencode.json"), JSON.stringify({}))
      },
    })
    let baseline = 0
    await Instance.provide({
      directory: base.path,
      fn: async () => {
        baseline = (await Plugin.list()).length
      },
    })
    await Instance.disposeAll()

    // With custom plugins configured — count should be the same
    await using withPlugins = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            plugin: ["file:///tmp/fake-plugin-a.ts", "file:///tmp/fake-plugin-b.ts"],
          }),
        )
      },
    })
    await Instance.provide({
      directory: withPlugins.path,
      fn: async () => {
        const hooks = await Plugin.list()
        expect(hooks.length).toBe(baseline)
      },
    })
  })

  test("TuiEvent.ToastShow is published with 'Plugins ignored' when plugins are configured", async () => {
    delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            plugin: ["file:///tmp/fake-plugin.ts"],
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const toasts: string[] = []
        const off = Bus.subscribe(TuiEvent.ToastShow, (evt) => {
          if (evt.properties.title) toasts.push(evt.properties.title)
        })
        await Plugin.init()
        off()
        expect(toasts).toContain("Plugins ignored")
      },
    })
  })

  test("no toast is published when no custom plugins are configured", async () => {
    delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(path.join(dir, "opencode.json"), JSON.stringify({}))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const toasts: string[] = []
        const off = Bus.subscribe(TuiEvent.ToastShow, (evt) => {
          if (evt.properties.title) toasts.push(evt.properties.title)
        })
        await Plugin.init()
        off()
        expect(toasts).not.toContain("Plugins ignored")
      },
    })
  })
})
