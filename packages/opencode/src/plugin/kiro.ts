import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { Log } from "../util/log"
import { Auth } from "../auth"
import { transform, type Auth as KiroAuth } from "./kiro/request"
import { transformStream } from "./kiro/stream"
import { setTimeout as sleep } from "node:timers/promises"
import path from "path"
import os from "os"
import fs from "fs"

const log = Log.create({ service: "plugin.kiro" })

const PROVIDER_ID = "kiro"
const BUILDER_ID_START_URL = "https://view.awsapps.com/start"
const UA_PREFIX = "aws-sdk-js/3.738.0"
const SCOPES = [
  "codewhisperer:completions",
  "codewhisperer:analysis",
  "codewhisperer:conversations",
  "codewhisperer:transformations",
  "codewhisperer:taskassist",
]
const POLLING_MARGIN_MS = 3000

// --- config ---

interface Config {
  default_region: string
  idc_start_url?: string
  idc_region?: string
  idc_profile_arn?: string
  token_expiry_buffer_ms: number
}

const DEFAULTS: Config = {
  default_region: "us-east-1",
  token_expiry_buffer_ms: 300000,
}

function configDir(): string {
  if (process.platform === "win32")
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "opencode")
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode")
}

function loadConfig(dir: string): Config {
  let cfg = { ...DEFAULTS }
  for (const p of [path.join(configDir(), "kiro.json"), path.join(dir, ".opencode", "kiro.json")]) {
    try {
      if (!fs.existsSync(p)) continue
      const data = JSON.parse(fs.readFileSync(p, "utf-8"))
      cfg = { ...cfg, ...data }
    } catch {}
  }
  const env = process.env
  if (env.KIRO_DEFAULT_REGION) cfg.default_region = env.KIRO_DEFAULT_REGION
  if (env.KIRO_TOKEN_EXPIRY_BUFFER_MS)
    cfg.token_expiry_buffer_ms = Number(env.KIRO_TOKEN_EXPIRY_BUFFER_MS) || cfg.token_expiry_buffer_ms
  return cfg
}

// credential encoding: refreshToken|clientId|clientSecret|idc
function decode(refresh: string) {
  const parts = refresh.split("|")
  if (parts.length < 2) return { token: parts[0]!, method: "desktop" as const }
  const method = parts[parts.length - 1] as string
  if (method === "idc") return { token: parts[0]!, clientId: parts[1], clientSecret: parts[2], method: "idc" as const }
  return { token: parts[0]!, method: "desktop" as const }
}

export function canThink(id: string, name: string) {
  const text = `${id} ${name}`.toLowerCase()
  return text.includes("sonnet") || text.includes("opus")
}

function encode(token: string, clientId?: string, clientSecret?: string, method?: string): string {
  if (method === "idc" && clientId && clientSecret) return `${token}|${clientId}|${clientSecret}|idc`
  return `${token}|desktop`
}

function expired(auth: { access: string; expires: number }, buffer: number): boolean {
  if (!auth.access) return true
  if (!auth.expires || auth.expires <= 0) return false
  return Date.now() >= auth.expires - buffer
}

async function refresh(
  auth: { refresh: string; access: string; expires: number },
  region: string,
  oidcRegion?: string,
): Promise<{ refresh: string; access: string; expires: number }> {
  const parts = decode(auth.refresh)
  const idc = parts.method === "idc"
  const r = oidcRegion || region
  const url = idc
    ? `https://oidc.${r}.amazonaws.com/token`
    : `https://prod.${region}.auth.desktop.kiro.dev/refreshToken`

  if (idc && (!parts.clientId || !parts.clientSecret)) throw new Error("Missing IDC credentials for token refresh")

  const body: any = idc
    ? {
        refreshToken: parts.token,
        clientId: parts.clientId,
        clientSecret: parts.clientSecret,
        grantType: "refresh_token",
      }
    : { refreshToken: parts.token }

  const ua = idc
    ? "aws-sdk-js/3.738.0 ua/2.1 os/other lang/js md/browser#unknown_unknown api/sso-oidc#3.738.0 m/E KiroIDE"
    : "aws-sdk-js/3.0.0 KiroIDE-0.1.0 os/macos lang/js md/nodejs/18.0.0"

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "amz-sdk-request": "attempt=1; max=1",
      "x-amzn-kiro-agent-mode": "vibe",
      "user-agent": ua,
      Connection: "close",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Kiro token refresh failed (${res.status}): ${txt.slice(0, 300)}`)
  }

  const d: any = await res.json()
  const acc = d.access_token || d.accessToken
  if (!acc) throw new Error("Kiro token refresh: no access token in response")

  const rt = d.refresh_token || d.refreshToken || parts.token
  return {
    refresh: encode(rt, parts.clientId, parts.clientSecret, parts.method),
    access: acc,
    expires: Date.now() + (d.expires_in || d.expiresIn || 3600) * 1000,
  }
}

async function getAuth(dir: string) {
  const cfg = loadConfig(dir)

  let info = await Auth.get(PROVIDER_ID)
  if (!info || info.type !== "oauth") return { cfg }

  if (expired(info, cfg.token_expiry_buffer_ms)) {
    const next = await refresh(info, cfg.default_region, cfg.idc_region)
    await Auth.set(PROVIDER_ID, {
      type: "oauth",
      refresh: next.refresh,
      access: next.access,
      expires: next.expires,
    })
    info = await Auth.get(PROVIDER_ID)
  }

  return { cfg, info: info && info.type === "oauth" ? info : undefined }
}

export async function loadModels(dir: string) {
  const auth = await getAuth(dir).catch(() => undefined)
  if (!auth?.info) return KIRO_MODELS

  const query = new URLSearchParams({
    origin: "AI_EDITOR",
    maxResults: "50",
  })
  if (auth.cfg.idc_profile_arn) query.set("profileArn", auth.cfg.idc_profile_arn)

  const out: typeof KIRO_MODELS = {}
  let next: string | undefined

  do {
    if (next) query.set("nextToken", next)
    else query.delete("nextToken")

    const res = await fetch(`https://q.${auth.cfg.default_region}.amazonaws.com/ListAvailableModels?${query}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.info.access}`,
        "x-amzn-codewhisperer-optout": "true",
        "x-amzn-kiro-agent-mode": "vibe",
        "x-amz-user-agent": "aws-sdk-js/3.738.0 KiroIDE",
        "user-agent": "aws-sdk-js/3.738.0 ua/2.1 os/other lang/js md/nodejs api/codewhisperer#3.738.0 m/E KiroIDE",
      },
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      log.warn("kiro model discovery failed", { status: res.status, body: txt.slice(0, 300) })
      return KIRO_MODELS
    }

    const data: any = await res.json()
    for (const item of data.models ?? []) {
      if (!item?.modelId || !item?.modelName) continue
      out[item.modelId] = {
        name: item.modelName,
        thinking: false,
        context: item.tokenLimits?.maxInputTokens ?? 200000,
        input: item.tokenLimits?.maxInputTokens ?? 200000,
        output: item.tokenLimits?.maxOutputTokens ?? 128000,
      }
    }
    next = data.nextToken
  } while (next)

  return Object.keys(out).length ? out : KIRO_MODELS
}

export async function KiroAuthPlugin(input: PluginInput): Promise<Hooks> {
  const cfg = loadConfig(input.directory)

  async function deviceCodeFlow(opts: { region: string; startUrl: string; method: string }) {
    const oidc = `https://oidc.${opts.region}.amazonaws.com`

    // register client
    const regRes = await fetch(`${oidc}/client/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "KiroIDE" },
      body: JSON.stringify({
        clientName: "Kiro IDE",
        clientType: "public",
        scopes: SCOPES,
        grantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
      }),
    })

    if (!regRes.ok) {
      const txt = await regRes.text().catch(() => "")
      throw new Error(`Kiro client registration failed: ${regRes.status} ${txt.slice(0, 300)}`)
    }

    const reg: any = await regRes.json()
    if (!reg.clientId || !reg.clientSecret) throw new Error("Kiro registration missing clientId/clientSecret")

    // device authorization
    const devRes = await fetch(`${oidc}/device_authorization`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "KiroIDE" },
      body: JSON.stringify({ clientId: reg.clientId, clientSecret: reg.clientSecret, startUrl: opts.startUrl }),
    })

    if (!devRes.ok) {
      const txt = await devRes.text().catch(() => "")
      throw new Error(`Kiro device authorization failed: ${devRes.status} ${txt.slice(0, 300)}`)
    }

    const dev: any = await devRes.json()
    if (!dev.deviceCode || !dev.userCode || !dev.verificationUri)
      throw new Error("Kiro device auth missing required fields")

    const interval = (dev.interval || 5) * 1000
    const maxTime = (dev.expiresIn || 600) * 1000

    return {
      url: dev.verificationUriComplete || dev.verificationUri,
      instructions: `Enter code: ${dev.userCode}`,
      method: "auto" as const,
      async callback() {
        const deadline = Date.now() + maxTime
        let delay = interval

        while (Date.now() < deadline) {
          await sleep(delay + POLLING_MARGIN_MS)

          const res = await fetch(`${oidc}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": "KiroIDE" },
            body: JSON.stringify({
              clientId: reg.clientId,
              clientSecret: reg.clientSecret,
              deviceCode: dev.deviceCode,
              grantType: "urn:ietf:params:oauth:grant-type:device_code",
            }),
          })

          const txt = await res.text()
          let data: any = {}
          try {
            data = JSON.parse(txt)
          } catch {
            data = {}
          }

          if (data.error === "authorization_pending") continue
          if (data.error === "slow_down") {
            delay += 5000
            continue
          }
          if (data.error === "expired_token" || data.error === "access_denied") return { type: "failed" as const }
          if (data.error) return { type: "failed" as const }

          const acc = data.access_token || data.accessToken
          const rt = data.refresh_token || data.refreshToken
          if (acc && rt) {
            const expires = Date.now() + (data.expires_in || data.expiresIn || 3600) * 1000
            return {
              type: "success" as const,
              refresh: encode(rt, reg.clientId, reg.clientSecret, opts.method),
              access: acc,
              expires,
            }
          }

          if (!res.ok) return { type: "failed" as const }
        }

        return { type: "failed" as const }
      },
    }
  }

  // map opencode session ID → persistent Kiro conversationId for reuse
  const conversations = new Map<string, string>()

  return {
    auth: {
      provider: PROVIDER_ID,
      async loader(getAuth) {
        const info = await getAuth()
        if (!info || info.type !== "oauth") return {}

        const region = cfg.default_region
        const base = `https://q.${region}.amazonaws.com`

        return {
          apiKey: "",
          baseURL: base,
          async fetch(request: RequestInfo | URL, init?: RequestInit) {
            const info = await getAuth()
            if (!info || info.type !== "oauth") return fetch(request, init)
            let auth = info
            if (!auth) return fetch(request, init)

            // refresh token if expired
            if (expired(auth, cfg.token_expiry_buffer_ms)) {
              log.info("refreshing kiro access token")
              try {
                const refreshed = await refresh(auth, region, cfg.idc_region)
                await Auth.set(PROVIDER_ID, {
                  type: "oauth",
                  refresh: refreshed.refresh,
                  access: refreshed.access,
                  expires: refreshed.expires,
                })
                const next = await getAuth()
                if (!next || next.type !== "oauth") return fetch(request, init)
                auth = next
              } catch (err) {
                log.error("kiro token refresh failed", { error: err instanceof Error ? err.message : String(err) })
                throw err
              }
            }

            // extract model from body
            const body = typeof init?.body === "string" ? init.body : undefined
            if (!body) return fetch(request, init)

            let parsed: any
            try {
              parsed = JSON.parse(body)
            } catch {
              return fetch(request, init)
            }

            const model = parsed.model as string
            if (!model) return fetch(request, init)

            const hdrs = init?.headers
            const hdr = (name: string) =>
              (hdrs instanceof Headers
                ? hdrs.get(name)
                : Array.isArray(hdrs)
                  ? hdrs.find(([k]) => k.toLowerCase() === name)?.[1]
                  : hdrs?.[name]) || ""
            const suffix = hdr("x-kiro-suffix")
            const session = hdr("x-kiro-session")
            const think = suffix.includes("thinking")
            const budget = think ? 32000 : 0
            const kiroAuth: KiroAuth = {
              access: auth.access,
              region,
              profileArn: cfg.idc_profile_arn,
            }

            const existing = session ? conversations.get(session) : undefined
            const prepared = transform(
              request instanceof URL ? request.href : request.toString(),
              parsed,
              model,
              kiroAuth,
              think,
              budget,
              1.0,
              existing,
            )

            log.info("kiro request", {
              model,
              resolved: prepared.model,
              conversation: prepared.conversation,
              reused: !!existing,
            })

            const res = await fetch(prepared.url, prepared.init)

            if (!res.ok) {
              const txt = await res.text().catch(() => "")
              log.error("kiro api error", { status: res.status, body: txt.slice(0, 500) })
              // invalidate on error so next request starts fresh
              if (session) conversations.delete(session)
              return new Response(txt, { status: res.status, headers: res.headers })
            }

            // persist conversationId for reuse on next turn
            if (session) conversations.set(session, prepared.conversation)

            // transform the response stream into OpenAI SSE format
            const gen = transformStream(res, model, prepared.conversation)
            const encoder = new TextEncoder()
            const stream = new ReadableStream({
              async pull(ctrl) {
                try {
                  const { done, value } = await gen.next()
                  if (done) {
                    ctrl.enqueue(encoder.encode("data: [DONE]\n\n"))
                    ctrl.close()
                    return
                  }
                  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
                } catch (err) {
                  log.error("kiro stream error", { error: err instanceof Error ? err.message : String(err) })
                  ctrl.error(err)
                }
              },
            })

            return new Response(stream, {
              status: 200,
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
            })
          },
        }
      },
      methods: [
        {
          type: "oauth" as const,
          label: "Login with AWS Builder ID",
          async authorize() {
            const region = cfg.default_region
            return deviceCodeFlow({ region, startUrl: BUILDER_ID_START_URL, method: "idc" })
          },
        },
        {
          type: "oauth" as const,
          label: "Login with IAM Identity Center",
          prompts: [
            {
              type: "text" as const,
              key: "startUrl",
              message: "Enter your IAM Identity Center start URL",
              placeholder: "https://d-xxxxxxxxxx.awsapps.com/start",
              validate: (value: string) => {
                if (!value) return "Start URL is required"
                try {
                  new URL(value)
                  return undefined
                } catch {
                  return "Please enter a valid URL"
                }
              },
            },
            {
              type: "text" as const,
              key: "region",
              message: "Enter AWS region",
              placeholder: cfg.idc_region || cfg.default_region,
              validate: (value: string) => {
                if (!value) return undefined // will use default
                if (!/^[a-z]{2}-[a-z]+-\d+$/.test(value)) return "Invalid region format (e.g., us-east-1)"
                return undefined
              },
            },
          ],
          async authorize(inputs = {}) {
            const region = inputs.region || cfg.idc_region || cfg.default_region
            const startUrl = inputs.startUrl || cfg.idc_start_url || BUILDER_ID_START_URL
            return deviceCodeFlow({ region, startUrl, method: "idc" })
          },
        },
      ],
    },
  }
}

export const KIRO_MODELS: Record<
  string,
  {
    name: string
    thinking: boolean
    context: number
    input: number
    output: number
  }
> = {
  "claude-sonnet-4-6": { name: "Claude Sonnet 4.6", thinking: false, context: 200000, input: 200000, output: 128000 },
  "claude-opus-4-6": { name: "Claude Opus 4.6", thinking: false, context: 200000, input: 200000, output: 128000 },
  "claude-sonnet-4-5": { name: "Claude Sonnet 4.5", thinking: false, context: 200000, input: 200000, output: 128000 },
  "claude-opus-4-5": { name: "Claude Opus 4.5", thinking: false, context: 200000, input: 200000, output: 128000 },
  "claude-haiku-4-5": { name: "Claude Haiku 4.5", thinking: false, context: 200000, input: 200000, output: 128000 },
  "qwen3-coder-480b": { name: "Qwen3 Coder 480B", thinking: false, context: 262144, input: 262144, output: 65536 },
}
