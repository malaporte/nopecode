import { afterEach, describe, expect, mock, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Plugin } from "../../src/plugin"
import { SessionStatus } from "../../src/session/status"
import { Session } from "../../src/session"
import { SessionID } from "../../src/session/schema"
import { Filesystem } from "../../src/util/filesystem"
import path from "path"
import { shouldNotify } from "../../src/plugin/notify"

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
})
