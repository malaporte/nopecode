import { describe, expect, test } from "bun:test"
import path from "path"
import { Agent } from "../../src/agent/agent"
import { Instance } from "../../src/project/instance"
import { BashTool } from "../../src/tool/bash"
import { BatchTool } from "../../src/tool/batch"
import { EditTool } from "../../src/tool/edit"
import { LspTool } from "../../src/tool/lsp"
import { ReadTool } from "../../src/tool/read"
import { TaskTool } from "../../src/tool/task"
import { TodoWriteTool } from "../../src/tool/todo"
import { ApplyPatchTool } from "../../src/tool/apply_patch"
import { WebSearchTool } from "../../src/tool/websearch"
import { tmpdir } from "../fixture/fixture"

const projectRoot = path.join(__dirname, "../..")

describe("light tool descriptions", () => {
  test("bash description is shorter in light mode", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const full = await BashTool.init()
        const light = await BashTool.init({ light: true })

        expect(light.description.length).toBeLessThan(full.description.length)
        expect(light.description).not.toContain("# Creating pull requests")
      },
    })
  })

  test("task description is shorter in light mode", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const build = await Agent.get("build")
        const full = await TaskTool.init({ agent: build })
        const light = await TaskTool.init({ agent: build, light: true })

        expect(light.description.length).toBeLessThan(full.description.length)
        expect(light.description).not.toContain("Example usage")
        expect(light.description).toContain("- explore:")
        expect(light.description).toContain("exactly one of the available agent names")
      },
    })
  })

  test("todo description is shorter in light mode", async () => {
    const full = await TodoWriteTool.init()
    const light = await TodoWriteTool.init({ light: true })

    expect(light.description.length).toBeLessThan(full.description.length)
    expect(light.description).not.toContain("## Examples of When to Use the Todo List")
  })

  test("other light descriptions are shorter", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const pairs = await Promise.all([
          Promise.all([EditTool.init(), EditTool.init({ light: true })]),
          Promise.all([ReadTool.init(), ReadTool.init({ light: true })]),
          Promise.all([ApplyPatchTool.init(), ApplyPatchTool.init({ light: true })]),
          Promise.all([WebSearchTool.init(), WebSearchTool.init({ light: true })]),
          Promise.all([LspTool.init(), LspTool.init({ light: true })]),
          Promise.all([BatchTool.init(), BatchTool.init({ light: true })]),
        ])

        for (const [full, light] of pairs) {
          expect(light.description.length).toBeLessThan(full.description.length)
        }
      },
    })
  })
})
