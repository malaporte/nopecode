// FORK VALIDATION: §4 Built-in Notification Plugin
// Verifies that NotifyPlugin is exported and loads as a built-in.
// Detailed shouldNotify / sender / resolve tests live in test/plugin/notify.test.ts.
// This file covers the structural invariants: the plugin is exported and present
// in the loaded hook set.

import { afterEach, describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Plugin } from "../../src/plugin"
import { NotifyPlugin } from "../../src/plugin/notify"
import { Filesystem } from "../../src/util/filesystem"
import path from "path"

const saved = process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]

afterEach(async () => {
  if (saved === undefined) delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
  else process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"] = saved
  await Instance.disposeAll()
})

describe("fork.notify", () => {
  test("NotifyPlugin is exported as a function from plugin/notify.ts", () => {
    expect(typeof NotifyPlugin).toBe("function")
  })

  test("NotifyPlugin loads as a built-in and contributes a hook", async () => {
    delete process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(path.join(dir, "opencode.json"), JSON.stringify({ notify: { enabled: true } }))
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hooks = await Plugin.list()
        // At minimum NotifyPlugin contributes one hook with an event handler
        const hasEventHook = hooks.some((h) => typeof (h as any).event === "function")
        expect(hasEventHook).toBe(true)
      },
    })
  })
})
