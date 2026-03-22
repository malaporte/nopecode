import type { AuthOuathResult } from "@opencode-ai/plugin"
import { NamedError } from "@opencode-ai/util/error"
import * as Auth from "@/auth/service"
import { ProviderID } from "./schema"
import { Effect, Layer, Record, ServiceMap } from "effect"
import { filter, fromEntries, map, pipe } from "remeda"
import z from "zod"

export const Prompt = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("text"),
      key: z.string(),
      message: z.string(),
      placeholder: z.string().optional(),
      condition: z.object({ key: z.string(), value: z.string() }).optional(),
    }),
    z.object({
      type: z.literal("select"),
      key: z.string(),
      message: z.string(),
      options: z.array(z.object({ label: z.string(), value: z.string(), hint: z.string().optional() })),
      condition: z.object({ key: z.string(), value: z.string() }).optional(),
    }),
  ])
  .meta({ ref: "ProviderAuthPrompt" })
export type Prompt = z.infer<typeof Prompt>

export const Method = z
  .object({
    type: z.union([z.literal("oauth"), z.literal("api")]),
    label: z.string(),
    prompts: z.array(Prompt).optional(),
  })
  .meta({
    ref: "ProviderAuthMethod",
  })
export type Method = z.infer<typeof Method>

export const Authorization = z
  .object({
    url: z.string(),
    method: z.union([z.literal("auto"), z.literal("code")]),
    instructions: z.string(),
  })
  .meta({
    ref: "ProviderAuthAuthorization",
  })
export type Authorization = z.infer<typeof Authorization>

export const OauthMissing = NamedError.create(
  "ProviderAuthOauthMissing",
  z.object({
    providerID: ProviderID.zod,
  }),
)

export const OauthCodeMissing = NamedError.create(
  "ProviderAuthOauthCodeMissing",
  z.object({
    providerID: ProviderID.zod,
  }),
)

export const OauthCallbackFailed = NamedError.create("ProviderAuthOauthCallbackFailed", z.object({}))

export type ProviderAuthError =
  | Auth.AuthServiceError
  | InstanceType<typeof OauthMissing>
  | InstanceType<typeof OauthCodeMissing>
  | InstanceType<typeof OauthCallbackFailed>

// Probe a condition function by calling it with each select option across all prompts
// to discover which key/value pair makes it return true.
function probeCondition(
  fn: (inputs: Record<string, string>) => boolean,
  prompts: Array<{ type: string; key: string; options?: Array<{ value: string }> }>,
): { key: string; value: string } | undefined {
  for (const p of prompts) {
    if (p.type !== "select" || !p.options) continue
    for (const opt of p.options) {
      if (fn({ [p.key]: opt.value })) return { key: p.key, value: opt.value }
    }
  }
  return undefined
}

export namespace ProviderAuthService {
  export interface Service {
    readonly methods: () => Effect.Effect<Record<string, Method[]>>
    readonly authorize: (input: {
      providerID: ProviderID
      method: number
      inputs?: Record<string, string>
    }) => Effect.Effect<Authorization | undefined>
    readonly callback: (input: {
      providerID: ProviderID
      method: number
      code?: string
    }) => Effect.Effect<void, ProviderAuthError>
  }
}

export class ProviderAuthService extends ServiceMap.Service<ProviderAuthService, ProviderAuthService.Service>()(
  "@opencode/ProviderAuth",
) {
  static readonly layer = Layer.effect(
    ProviderAuthService,
    Effect.gen(function* () {
      const auth = yield* Auth.AuthService
      const hooks = yield* Effect.promise(async () => {
        const mod = await import("../plugin")
        return pipe(
          await mod.Plugin.list(),
          filter((x) => x.auth?.provider !== undefined),
          map((x) => [x.auth!.provider, x.auth!] as const),
          fromEntries(),
        )
      })
      const pending = new Map<ProviderID, AuthOuathResult>()

      const methods = Effect.fn("ProviderAuthService.methods")(function* () {
        return Record.map(hooks, (item) =>
          item.methods.map(
            (method): Method => ({
              type: method.type,
              label: method.label,
              prompts: method.prompts?.map((p) => {
                const cond = p.condition ? probeCondition(p.condition, method.prompts ?? []) : undefined
                if (p.type === "select")
                  return {
                    type: "select" as const,
                    key: p.key,
                    message: p.message,
                    options: p.options,
                    condition: cond,
                  }
                return {
                  type: "text" as const,
                  key: p.key,
                  message: p.message,
                  placeholder: p.placeholder,
                  condition: cond,
                }
              }),
            }),
          ),
        )
      })

      const authorize = Effect.fn("ProviderAuthService.authorize")(function* (input: {
        providerID: ProviderID
        method: number
        inputs?: Record<string, string>
      }) {
        const method = hooks[input.providerID].methods[input.method]
        if (method.type !== "oauth") return
        const result = yield* Effect.promise(() => method.authorize(input.inputs))
        pending.set(input.providerID, result)
        return {
          url: result.url,
          method: result.method,
          instructions: result.instructions,
        }
      })

      const callback = Effect.fn("ProviderAuthService.callback")(function* (input: {
        providerID: ProviderID
        method: number
        code?: string
      }) {
        const match = pending.get(input.providerID)
        if (!match) return yield* Effect.fail(new OauthMissing({ providerID: input.providerID }))
        if (match.method === "code" && !input.code)
          return yield* Effect.fail(new OauthCodeMissing({ providerID: input.providerID }))

        const result = yield* Effect.promise(() =>
          match.method === "code" ? match.callback(input.code!) : match.callback(),
        )
        if (!result || result.type !== "success") return yield* Effect.fail(new OauthCallbackFailed({}))

        if ("key" in result) {
          yield* auth.set(input.providerID, {
            type: "api",
            key: result.key,
          })
        }

        if ("refresh" in result) {
          yield* auth.set(input.providerID, {
            type: "oauth",
            access: result.access,
            refresh: result.refresh,
            expires: result.expires,
            ...(result.accountId ? { accountId: result.accountId } : {}),
          })
        }
      })

      return ProviderAuthService.of({
        methods,
        authorize,
        callback,
      })
    }),
  )

  static readonly defaultLayer = ProviderAuthService.layer.pipe(Layer.provide(Auth.AuthService.defaultLayer))
}
