import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { tmpdir } from "../fixture/fixture"

describe("session light mode", () => {
  test("persists when set directly", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const updated = await Session.setLight({
          sessionID: session.id,
          light: { enabled: true },
        })

        expect(updated.light).toEqual({ enabled: true })
        expect((await Session.get(session.id)).light).toEqual({ enabled: true })
      },
    })
  })

  test("inherits from parent session", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const parent = await Session.create({ light: { enabled: true } })
        const child = await Session.create({ parentID: parent.id })

        expect(child.light).toEqual({ enabled: true })
      },
    })
  })

  test("fork inherits from source session", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ light: { enabled: true } })
        const fork = await Session.fork({ sessionID: session.id })

        expect(fork.light).toEqual({ enabled: true })
      },
    })
  })
})
