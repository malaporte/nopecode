import type { Hooks, PluginInput, Plugin as PluginInstance, PluginModule } from "@opencode-ai/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { Session } from "../session"
import { NamedError } from "@opencode-ai/util/error"
import { CopilotAuthPlugin } from "./copilot"
import { KiroAuthPlugin } from "./kiro"
import { gitlabAuthPlugin as GitlabAuthPlugin } from "opencode-gitlab-auth"
import { TuiEvent } from "@/cli/cmd/tui/event"
import { NotifyPlugin } from "./notify"
import { Effect, Layer, ServiceMap } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { makeRuntime } from "@/effect/run-service"
import { errorMessage } from "@/util/error"
import { PluginLoader } from "./loader"
import { parsePluginSpecifier, readPluginId, readV1Plugin, resolvePluginId } from "./shared"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  type State = {
    hooks: Hooks[]
  }

  type Loaded = {
    row: PluginLoader.Loaded
  }

  // Hook names that follow the (input, output) => Promise<void> trigger pattern
  type TriggerName = {
    [K in keyof Hooks]-?: NonNullable<Hooks[K]> extends (input: any, output: any) => Promise<void> ? K : never
  }[keyof Hooks]

  export interface Interface {
    readonly trigger: <
      Name extends TriggerName,
      Input = Parameters<Required<Hooks>[Name]>[0],
      Output = Parameters<Required<Hooks>[Name]>[1],
    >(
      name: Name,
      input: Input,
      output: Output,
    ) => Effect.Effect<Output>
    readonly list: () => Effect.Effect<Hooks[]>
    readonly init: () => Effect.Effect<void>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Plugin") {}

  // Built-in plugins that are directly imported (not installed from npm)
  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin,
    CopilotAuthPlugin,
    KiroAuthPlugin,
    GitlabAuthPlugin,
    NotifyPlugin,
  ]

  function isServerPlugin(value: unknown): value is PluginInstance {
    return typeof value === "function"
  }

  function getServerPlugin(value: unknown) {
    if (isServerPlugin(value)) return value
    if (!value || typeof value !== "object" || !("server" in value)) return
    if (!isServerPlugin(value.server)) return
    return value.server
  }

  function getLegacyPlugins(mod: Record<string, unknown>) {
    const seen = new Set<unknown>()
    const result: PluginInstance[] = []

    for (const entry of Object.values(mod)) {
      if (seen.has(entry)) continue
      seen.add(entry)
      const plugin = getServerPlugin(entry)
      if (!plugin) throw new TypeError("Plugin export is not a function")
      result.push(plugin)
    }

    return result
  }

  async function applyPlugin(load: Loaded, input: PluginInput, hooks: Hooks[]) {
    const plugin = readV1Plugin(load.row.mod, load.row.spec, "server", "detect")
    if (plugin) {
      await resolvePluginId(
        load.row.source,
        load.row.spec,
        load.row.target,
        readPluginId(plugin.id, load.row.spec),
        load.row.pkg,
      )
      hooks.push(await (plugin as PluginModule).server(input, load.row.options))
      return
    }

    for (const server of getLegacyPlugins(load.row.mod)) {
      hooks.push(await server(input, load.row.options))
    }
  }

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      const config = yield* Config.Service

      const cache = yield* InstanceState.make<State>(
        Effect.fn("Plugin.state")(function* (ctx) {
          const hooks: Hooks[] = []

          const { Server } = yield* Effect.promise(() => import("../server/server"))

          const client = createOpencodeClient({
            baseUrl: "http://localhost:4096",
            directory: ctx.directory,
            headers: Flag.OPENCODE_SERVER_PASSWORD
              ? {
                  Authorization: `Basic ${Buffer.from(`${Flag.OPENCODE_SERVER_USERNAME ?? "opencode"}:${Flag.OPENCODE_SERVER_PASSWORD}`).toString("base64")}`,
                }
              : undefined,
            fetch: async (...args) => Server.Default().fetch(...args),
          })
          const cfg = yield* config.get()
          const input: PluginInput = {
            client,
            project: ctx.project,
            worktree: ctx.worktree,
            directory: ctx.directory,
            get serverUrl(): URL {
              return Server.url ?? new URL("http://localhost:4096")
            },
            $: Bun.$,
          }

          for (const plugin of INTERNAL_PLUGINS) {
            log.info("loading internal plugin", { name: plugin.name })
            const init = yield* Effect.tryPromise({
              try: () => plugin(input),
              catch: (err) => {
                log.error("failed to load internal plugin", { name: plugin.name, error: err })
              },
            }).pipe(Effect.option)
            if (init._tag === "Some") hooks.push(init.value)
          }

          // Custom plugins are disabled in this fork
          if ((cfg.plugin ?? []).length) {
            log.warn("ignoring custom plugins", { plugins: cfg.plugin })
            yield* bus.publish(TuiEvent.ToastShow, {
              title: "Plugins ignored",
              message: "Custom plugins are disabled in this build and configured plugins will be ignored.",
              variant: "warning",
            })
          }

          // Notify plugins of current config
          for (const hook of hooks) {
            yield* Effect.tryPromise({
              try: () => Promise.resolve((hook as any).config?.(cfg)),
              catch: (err) => {
                log.error("plugin config hook failed", { error: err })
              },
            }).pipe(Effect.ignore)
          }

          // Subscribe to bus events, clean up when scope is closed
          yield* Effect.acquireRelease(
            Effect.sync(() =>
              Bus.subscribeAll(async (input) => {
                for (const hook of hooks) {
                  hook["event"]?.({ event: input })
                }
              }),
            ),
            (unsub) => Effect.sync(unsub),
          )

          return { hooks }
        }),
      )

      const trigger = Effect.fn("Plugin.trigger")(function* <
        Name extends TriggerName,
        Input = Parameters<Required<Hooks>[Name]>[0],
        Output = Parameters<Required<Hooks>[Name]>[1],
      >(name: Name, input: Input, output: Output) {
        if (!name) return output
        const state = yield* InstanceState.get(cache)
        for (const hook of state.hooks) {
          const fn = hook[name] as any
          if (!fn) continue
          yield* Effect.promise(async () => fn(input, output))
        }
        return output
      })

      const list = Effect.fn("Plugin.list")(function* () {
        const state = yield* InstanceState.get(cache)
        return state.hooks
      })

      const init = Effect.fn("Plugin.init")(function* () {
        yield* InstanceState.get(cache)
      })

      return Service.of({ trigger, list, init })
    }),
  )

  export const defaultLayer = layer.pipe(Layer.provide(Bus.layer), Layer.provide(Config.defaultLayer))
  const { runPromise } = makeRuntime(Service, defaultLayer)

  export async function trigger<
    Name extends TriggerName,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    return runPromise((svc) => svc.trigger(name, input, output))
  }

  export async function list(): Promise<Hooks[]> {
    return runPromise((svc) => svc.list())
  }

  export async function init() {
    return runPromise((svc) => svc.init())
  }
}
