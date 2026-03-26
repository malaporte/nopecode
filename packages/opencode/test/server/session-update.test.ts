import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Server } from "../../src/server/server"
import { tmpdir } from "../fixture/fixture"

describe("session.update", () => {
  test("updates light mode", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const app = Server.Default()
        const response = await app.request(`/session/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ light: { enabled: true } }),
        })

        expect(response.status).toBe(200)
        expect((await response.json()).light).toEqual({ enabled: true })
        expect((await Session.get(session.id)).light).toEqual({ enabled: true })
      },
    })
  })
})
