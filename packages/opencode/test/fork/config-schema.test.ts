// FORK VALIDATION: Config schema additions
// Verifies that fork-specific config fields (notify, sandbox) and TUI fields
// (max_prose_width) are present in the schema. A merge that drops these fields
// would silently break the features that depend on them.

import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { TuiOptions } from "../../src/config/tui-schema"

describe("fork.config-schema", () => {
  test("notify field exists in Config.Info schema", () => {
    expect(Config.Info.shape.notify).toBeDefined()
  })

  test("notify.enabled is an optional boolean", () => {
    const result = Config.Info.safeParse({ notify: { enabled: false } })
    expect(result.success).toBe(true)
    const result2 = Config.Info.safeParse({ notify: {} })
    expect(result2.success).toBe(true)
  })

  test("notify.sound is an optional boolean", () => {
    const result = Config.Info.safeParse({ notify: { sound: true } })
    expect(result.success).toBe(true)
  })

  test("notify defaults to undefined when absent", () => {
    const result = Config.Info.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.notify).toBeUndefined()
  })

  test("sandbox field exists in Config.Info schema", () => {
    expect(Config.Info.shape.sandbox).toBeDefined()
  })

  test("sandbox.enabled is an optional boolean", () => {
    const ok1 = Config.Info.safeParse({ sandbox: { enabled: true } })
    expect(ok1.success).toBe(true)
    const ok2 = Config.Info.safeParse({ sandbox: { enabled: false } })
    expect(ok2.success).toBe(true)
    const ok3 = Config.Info.safeParse({ sandbox: {} })
    expect(ok3.success).toBe(true)
  })

  test("sandbox defaults to undefined when absent", () => {
    const result = Config.Info.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.sandbox).toBeUndefined()
  })

  test("max_prose_width field exists in TuiOptions schema", () => {
    expect(TuiOptions.shape.max_prose_width).toBeDefined()
  })

  test("max_prose_width has a minimum of 40", () => {
    const ok = TuiOptions.safeParse({ max_prose_width: 40 })
    expect(ok.success).toBe(true)
    const fail = TuiOptions.safeParse({ max_prose_width: 39 })
    expect(fail.success).toBe(false)
  })

  test("max_prose_width is optional", () => {
    const result = TuiOptions.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.max_prose_width).toBeUndefined()
  })
})
