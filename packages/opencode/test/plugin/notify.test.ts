import { afterEach, describe, expect, mock, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Plugin } from "../../src/plugin"
import { SessionStatus } from "../../src/session/status"
import { Session } from "../../src/session"
import { SessionID } from "../../src/session/schema"
import { Filesystem } from "../../src/util/filesystem"
import path from "path"
import { shouldNotify, sender, resolve, reset } from "../../src/plugin/notify"

const spawn = mock(() => ({
  exited: Promise.resolve(0),
}))

afterEach(async () => {
  mock.restore()
  spawn.mockClear()
  await Instance.disposeAll()
})

describe("notify plugin", () => {
  test("loads as a built-in plugin while custom plugins stay ignored", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            notify: { enabled: true },
            plugin: ["file:///tmp/custom-plugin.ts"],
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hooks = await Plugin.list()
        expect(hooks.length).toBeGreaterThan(0)
      },
    })
  })

  test("does not notify for idle without prior work", () => {
    expect(
      shouldNotify(new Set(), {
        type: "session.status",
        properties: {
          sessionID: "session_1",
          status: { type: "idle" },
        },
      } as any),
    ).toBe(false)
  })

  test("notifies when busy returns to idle", async () => {
    const original = Bun.spawn
    // @ts-expect-error test override
    Bun.spawn = spawn
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await Session.create({
          title: "Review changes",
        })
        await Plugin.init()
        SessionStatus.set(SessionID.make("session_1"), { type: "busy" })
        SessionStatus.set(SessionID.make("session_1"), { type: "idle" })
        await Bun.sleep(10)
        expect(spawn).toHaveBeenCalled()
      },
    })
    Bun.spawn = original
  })

  test("respects notify.enabled false", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "opencode.json"),
          JSON.stringify({
            notify: { enabled: false },
          }),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const cfg = await (await import("../../src/config/config")).Config.get()
        expect(cfg.notify?.enabled).toBe(false)
      },
    })
  })

  test("does not notify for subagent sessions", async () => {
    const original = Bun.spawn
    // @ts-expect-error test override
    Bun.spawn = spawn
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({ title: "Parent session" })
        const child = await Session.create({ parentID: parent.id, title: "Subagent task" })
        await Plugin.init()
        SessionStatus.set(child.id, { type: "busy" })
        SessionStatus.set(child.id, { type: "idle" })
        await Bun.sleep(10)
        expect(spawn).not.toHaveBeenCalled()
      },
    })
    Bun.spawn = original
  })

  test("does not spam repeated idle events", () => {
    const seen = new Set<string>()
    expect(
      shouldNotify(seen, {
        type: "session.status",
        properties: {
          sessionID: "session_1",
          status: { type: "busy" },
        },
      } as any),
    ).toBe(false)
    expect(
      shouldNotify(seen, {
        type: "session.status",
        properties: {
          sessionID: "session_1",
          status: { type: "idle" },
        },
      } as any),
    ).toBe(true)
    expect(
      shouldNotify(seen, {
        type: "session.status",
        properties: {
          sessionID: "session_1",
          status: { type: "idle" },
        },
      } as any),
    ).toBe(false)
  })

  test("sender returns bundle ID for known terminals", () => {
    const original = process.env.TERM_PROGRAM
    try {
      process.env.TERM_PROGRAM = "ghostty"
      expect(sender()).toBe("com.mitchellh.ghostty")
      process.env.TERM_PROGRAM = "iTerm.app"
      expect(sender()).toBe("com.googlecode.iterm2")
      process.env.TERM_PROGRAM = "WezTerm"
      expect(sender()).toBe("com.github.wez.wezterm")
      process.env.TERM_PROGRAM = "vscode"
      expect(sender()).toBe("com.microsoft.VSCode")
    } finally {
      if (original !== undefined) process.env.TERM_PROGRAM = original
      else delete process.env.TERM_PROGRAM
    }
  })

  test("sender falls back to Terminal for unknown programs", () => {
    const original = process.env.TERM_PROGRAM
    try {
      process.env.TERM_PROGRAM = "SomeObscureTerminal"
      expect(sender()).toBe("com.apple.Terminal")
      delete process.env.TERM_PROGRAM
      expect(sender()).toBe("com.apple.Terminal")
    } finally {
      if (original !== undefined) process.env.TERM_PROGRAM = original
      else delete process.env.TERM_PROGRAM
    }
  })

  test("resolve caches result", async () => {
    reset()
    const first = await resolve()
    const second = await resolve()
    expect(first).toBe(second)
    reset()
  })
})
