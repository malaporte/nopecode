import * as crypto from "crypto"
import * as os from "os"

const BASE_URL = "https://q.{{region}}.amazonaws.com/generateAssistantResponse"
const ORIGIN = "AI_EDITOR"
const TRIGGER = "MANUAL"
const UA_PREFIX = "aws-sdk-js/3.738.0"

const MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4.5",
  "claude-sonnet-4-5": "claude-sonnet-4.5",
  "claude-sonnet-4-5-thinking": "claude-sonnet-4.5",
  "claude-sonnet-4-5-1m": "claude-sonnet-4.5-1m",
  "claude-sonnet-4-5-1m-thinking": "claude-sonnet-4.5-1m",
  "claude-sonnet-4-6": "claude-sonnet-4.6",
  "claude-sonnet-4-6-thinking": "claude-sonnet-4.6",
  "claude-sonnet-4-6-1m": "claude-sonnet-4.6-1m",
  "claude-sonnet-4-6-1m-thinking": "claude-sonnet-4.6-1m",
  "claude-opus-4-5": "claude-opus-4.5",
  "claude-opus-4-5-thinking": "claude-opus-4.5",
  "claude-opus-4-6": "claude-opus-4.6",
  "claude-opus-4-6-thinking": "claude-opus-4.6",
  "claude-opus-4-6-1m": "claude-opus-4.6-1m",
  "claude-opus-4-6-1m-thinking": "claude-opus-4.6-1m",
  "qwen3-coder-480b": "QWEN3_CODER_480B_A35B_1_0",
}

interface CachePoint {
  type: "default"
}

interface CWMessage {
  userInputMessage?: {
    content: string
    modelId: string
    origin: string
    cachePoint?: CachePoint
    images?: Array<{ format: string; source: { bytes: string } }>
    userInputMessageContext?: {
      toolResults?: Array<{ toolUseId: string; content: Array<{ text?: string }>; status?: string }>
      tools?: Array<{
        toolSpecification: { name: string; description: string; inputSchema: { json: Record<string, unknown> } }
      }>
    }
  }
  assistantResponseMessage?: {
    content: string
    cachePoint?: CachePoint
    toolUses?: Array<{ input: any; name: string; toolUseId: string }>
  }
}

interface CWRequest {
  conversationState: {
    chatTriggerType: string
    conversationId: string
    history?: CWMessage[]
    currentMessage: CWMessage
  }
  profileArn?: string
}

export interface Prepared {
  url: string
  init: RequestInit
  streaming: boolean
  model: string
  conversation: string
}

export interface Auth {
  access: string
  region: string
  profileArn?: string
}

function resolve(model: string): string {
  if (MODEL_MAP[model]) return MODEL_MAP[model]
  // try dash-separated form (e.g. claude-sonnet-4.6 → claude-sonnet-4-6)
  const dashed = model.replace(/(\d+)\.(\d+)/g, "$1-$2")
  if (MODEL_MAP[dashed]) return MODEL_MAP[dashed]
  return model
}

function regionFromArn(arn: string | undefined): string | undefined {
  if (!arn) return undefined
  const parts = arn.split(":")
  if (parts.length < 6 || parts[0] !== "arn") return undefined
  return parts[3] || undefined
}

function text(m: any): string {
  if (!m) return ""
  if (typeof m === "string") return m
  if (typeof m.content === "string") return m.content
  if (Array.isArray(m.content))
    return m.content
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text || "")
      .join("")
  return m.text || ""
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  const half = Math.floor(max / 2)
  return s.substring(0, half) + "\n... [TRUNCATED] ...\n" + s.substring(s.length - half)
}

function textFromParts(parts: any[]): string {
  return parts
    .filter((p: any) => p.type === "text" || (p.text && typeof p.text === "string"))
    .map((p: any) => p.text || "")
    .join("")
}

function images(content: any[]): Array<{ format: string; source: { bytes: string } }> {
  if (!Array.isArray(content)) return []
  const result: Array<{ format: string; source: { bytes: string } }> = []
  for (const item of content) {
    if (item.type === "image" && item.source?.type === "base64") {
      result.push({
        format: (item.source.media_type || "image/jpeg").split("/")[1] || "png",
        source: { bytes: item.source.data },
      })
    }
    if (item.type === "image_url" && item.image_url?.url?.startsWith("data:")) {
      const [header, data] = item.image_url.url.split(",", 2)
      if (data) {
        result.push({
          format: (header.split(";")[0].replace("data:", "") || "image/jpeg").split("/")[1] || "png",
          source: { bytes: data },
        })
      }
    }
  }
  return result
}

function tools(list: any[]): any[] {
  return list.map((t: any) => ({
    toolSpecification: {
      name: t.name || t.function?.name,
      description: (t.description || t.function?.description || "").substring(0, 9216),
      inputSchema: { json: t.input_schema || t.function?.parameters || {} },
    },
  }))
}

function dedup(trs: any[]): any[] {
  const seen = new Set<string>()
  return trs.filter((t) => {
    if (seen.has(t.toolUseId)) return false
    seen.add(t.toolUseId)
    return true
  })
}

function merge(msgs: any[]): any[] {
  const result: any[] = []
  for (const m of msgs) {
    if (!result.length) {
      result.push({ ...m })
      continue
    }
    const last = result[result.length - 1]
    if (last && m.role === last.role) {
      if (Array.isArray(last.content) && Array.isArray(m.content)) last.content.push(...m.content)
      else if (typeof last.content === "string" && typeof m.content === "string") last.content += "\n" + m.content
      else if (Array.isArray(last.content) && typeof m.content === "string")
        last.content.push({ type: "text", text: m.content })
      else if (typeof last.content === "string" && Array.isArray(m.content))
        last.content = [{ type: "text", text: last.content }, ...m.content]
      if (m.tool_calls) {
        if (!last.tool_calls) last.tool_calls = []
        last.tool_calls.push(...m.tool_calls)
      }
      if (m.role === "tool") {
        if (!last.tool_results) last.tool_results = [{ content: last.content, tool_call_id: last.tool_call_id }]
        last.tool_results.push({ content: m.content, tool_call_id: m.tool_call_id })
      }
    } else {
      result.push({ ...m })
    }
  }
  return result
}

function sanitize(history: CWMessage[]): CWMessage[] {
  const result: CWMessage[] = []
  for (let i = 0; i < history.length; i++) {
    const m = history[i]
    if (!m) continue
    if (m.assistantResponseMessage?.toolUses) {
      const next = history[i + 1]
      if (next?.userInputMessage?.userInputMessageContext?.toolResults) result.push(m)
    } else if (m.userInputMessage?.userInputMessageContext?.toolResults) {
      const prev = result[result.length - 1]
      if (prev?.assistantResponseMessage?.toolUses) result.push(m)
    } else {
      result.push(m)
    }
  }
  while (result.length > 0) {
    const first = result[0]
    if (first?.userInputMessage && !first.userInputMessage.userInputMessageContext?.toolResults) break
    result.shift()
  }
  while (result.length > 0 && result[result.length - 1]?.assistantResponseMessage?.toolUses) result.pop()
  return result
}

function findToolCall(msgs: any[], id: string): any | null {
  for (const m of msgs) {
    if (m.role !== "assistant") continue
    if (m.tool_calls) for (const tc of m.tool_calls) if (tc.id === id) return tc
    if (Array.isArray(m.content)) for (const p of m.content) if (p.type === "tool_use" && p.id === id) return p
  }
  return null
}

function buildHistory(msgs: any[], resolved: string, limit: number): CWMessage[] {
  const history: CWMessage[] = []
  for (let i = 0; i < msgs.length - 1; i++) {
    const m = msgs[i]
    if (!m) continue
    if (m.role === "user") {
      const uim: any = { content: "", modelId: resolved, origin: ORIGIN }
      const trs: any[] = []
      if (Array.isArray(m.content)) {
        uim.content = textFromParts(m.content)
        for (const p of m.content) {
          if (p.type === "tool_result") {
            trs.push({
              content: [{ text: truncate(text(p.content || p), limit) }],
              status: "success",
              toolUseId: p.tool_use_id,
            })
          }
        }
        const imgs = images(m.content)
        if (imgs.length > 0) uim.images = imgs
      } else {
        uim.content = text(m)
      }
      if (trs.length) uim.userInputMessageContext = { toolResults: dedup(trs) }
      const prev = history[history.length - 1]
      if (prev && prev.userInputMessage) history.push({ assistantResponseMessage: { content: "Continue" } })
      history.push({ userInputMessage: uim })
    } else if (m.role === "tool") {
      const trs: any[] = []
      if (m.tool_results) {
        for (const tr of m.tool_results)
          trs.push({ content: [{ text: truncate(text(tr), limit) }], status: "success", toolUseId: tr.tool_call_id })
      } else {
        trs.push({ content: [{ text: truncate(text(m), limit) }], status: "success", toolUseId: m.tool_call_id })
      }
      const prev = history[history.length - 1]
      if (prev && prev.userInputMessage) history.push({ assistantResponseMessage: { content: "Continue" } })
      history.push({
        userInputMessage: {
          content: "Tool results provided.",
          modelId: resolved,
          origin: ORIGIN,
          userInputMessageContext: { toolResults: dedup(trs) },
        },
      })
    } else if (m.role === "assistant") {
      const arm: any = { content: "" }
      const tus: any[] = []
      let th = ""
      if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === "text") arm.content += p.text || ""
          else if (p.type === "thinking") th += p.thinking || p.text || ""
          else if (p.type === "tool_use") tus.push({ input: p.input, name: p.name, toolUseId: p.id })
        }
      } else {
        arm.content = text(m)
      }
      if (m.tool_calls && Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          tus.push({
            input:
              typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments,
            name: tc.function?.name,
            toolUseId: tc.id,
          })
        }
      }
      if (th) arm.content = arm.content ? `<thinking>${th}</thinking>\n\n${arm.content}` : `<thinking>${th}</thinking>`
      if (tus.length) arm.toolUses = tus
      if (!arm.content && !arm.toolUses) continue
      const prev = history[history.length - 1]
      if (prev && prev.assistantResponseMessage) {
        if (arm.content)
          prev.assistantResponseMessage.content = prev.assistantResponseMessage.content
            ? `${prev.assistantResponseMessage.content}\n\n${arm.content}`
            : arm.content
        if (arm.toolUses)
          prev.assistantResponseMessage.toolUses = [...(prev.assistantResponseMessage.toolUses || []), ...arm.toolUses]
      } else {
        history.push({ assistantResponseMessage: arm })
      }
    }
  }
  return history
}

function truncateHistory(history: CWMessage[], limit: number): CWMessage[] {
  let result = sanitize(history)
  let size = JSON.stringify(result).length
  while (size > limit && result.length > 2) {
    result.shift()
    while (result.length > 0) {
      if (result[0]?.userInputMessage) break
      result.shift()
    }
    result = sanitize(result)
    size = JSON.stringify(result).length
  }
  return result
}

function toolNamesFromHistory(history: CWMessage[]): Set<string> {
  const names = new Set<string>()
  for (const h of history) {
    if (h.assistantResponseMessage?.toolUses) {
      for (const tu of h.assistantResponseMessage.toolUses) if (tu.name) names.add(tu.name)
    }
  }
  return names
}

function historyHasTools(history: CWMessage[]): boolean {
  return history.some(
    (h) => h.assistantResponseMessage?.toolUses || h.userInputMessage?.userInputMessageContext?.toolResults,
  )
}

export function transform(
  url: string,
  body: any,
  model: string,
  auth: Auth,
  think: boolean,
  budget: number,
  reduction = 1.0,
  reuse?: string,
): Prepared {
  const req = typeof body === "string" ? JSON.parse(body) : body
  const { messages, tools: reqTools, system } = req
  const conversation = reuse || crypto.randomUUID()
  if (!messages || messages.length === 0) throw new Error("No messages")
  const resolved = resolve(model)
  const systemMsgs = messages.filter((m: any) => m.role === "system")
  const otherMsgs = messages.filter((m: any) => m.role !== "system")
  let sys = system || ""
  if (systemMsgs.length > 0) {
    const extracted = systemMsgs.map((m: any) => text(m)).join("\n\n")
    sys = sys ? `${sys}\n\n${extracted}` : extracted
  }
  if (think) {
    const pfx = `<thinking_mode>enabled</thinking_mode><max_thinking_length>${budget}</max_thinking_length>`
    sys = sys.includes("<thinking_mode>") ? sys : sys ? `${pfx}\n${sys}` : pfx
  }
  const msgs = merge([...otherMsgs])
  const last = msgs[msgs.length - 1]
  if (last && last.role === "assistant" && text(last) === "{") msgs.pop()
  const cwTools = reqTools ? tools(reqTools) : []
  const longCtx = model.includes("-1m")
  const toolLimit = Math.floor((longCtx ? 1250000 : 250000) * reduction)

  let history = buildHistory(msgs, resolved, toolLimit)
  const historyLimit = Math.floor((longCtx ? 4250000 : 850000) * reduction)
  history = truncateHistory(history, historyLimit)

  // inject system prompt into first user message
  if (sys) {
    const first = history.find((h) => !!h.userInputMessage)
    if (first && first.userInputMessage) {
      first.userInputMessage.content = `${sys}\n\n${first.userInputMessage.content || ""}`
    } else {
      history.unshift({ userInputMessage: { content: sys, modelId: resolved, origin: ORIGIN } })
    }
  }

  // annotate cache points: first user message (system prompt) and last assistant message
  // limited to 2 cache checkpoints per request
  if (history.length > 0) {
    const first = history.find((h) => !!h.userInputMessage)
    if (first?.userInputMessage) first.userInputMessage.cachePoint = { type: "default" }

    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i]
      if (h?.assistantResponseMessage && h !== first) {
        h.assistantResponseMessage.cachePoint = { type: "default" }
        break
      }
    }
  }

  const cur = msgs[msgs.length - 1]
  if (!cur) throw new Error("Empty")
  let content = ""
  const curTrs: any[] = []
  const curImgs: Array<{ format: string; source: { bytes: string } }> = []

  if (cur.role === "assistant") {
    const arm: any = { content: "" }
    let th = ""
    if (Array.isArray(cur.content)) {
      for (const p of cur.content) {
        if (p.type === "text") arm.content += p.text || ""
        else if (p.type === "thinking") th += p.thinking || p.text || ""
        else if (p.type === "tool_use") {
          if (!arm.toolUses) arm.toolUses = []
          arm.toolUses.push({ input: p.input, name: p.name, toolUseId: p.id })
        }
      }
    } else {
      arm.content = text(cur)
    }
    if (cur.tool_calls && Array.isArray(cur.tool_calls)) {
      if (!arm.toolUses) arm.toolUses = []
      for (const tc of cur.tool_calls) {
        arm.toolUses.push({
          input:
            typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments,
          name: tc.function?.name,
          toolUseId: tc.id,
        })
      }
    }
    if (th) arm.content = arm.content ? `<thinking>${th}</thinking>\n\n${arm.content}` : `<thinking>${th}</thinking>`
    if (arm.content || arm.toolUses) history.push({ assistantResponseMessage: arm })
    content = "Continue"
  } else {
    const prev = history[history.length - 1]
    if (prev && !prev.assistantResponseMessage) history.push({ assistantResponseMessage: { content: "Continue" } })
    if (cur.role === "tool") {
      if (cur.tool_results) {
        for (const tr of cur.tool_results)
          curTrs.push({
            content: [{ text: truncate(text(tr), toolLimit) }],
            status: "success",
            toolUseId: tr.tool_call_id,
          })
      } else {
        curTrs.push({
          content: [{ text: truncate(text(cur), toolLimit) }],
          status: "success",
          toolUseId: cur.tool_call_id,
        })
      }
    } else if (Array.isArray(cur.content)) {
      content = textFromParts(cur.content)
      for (const p of cur.content) {
        if (p.type === "tool_result") {
          curTrs.push({
            content: [{ text: truncate(text(p.content || p), toolLimit) }],
            status: "success",
            toolUseId: p.tool_use_id,
          })
        }
      }
      const imgs = images(cur.content)
      if (imgs.length > 0) curImgs.push(...imgs)
    } else {
      content = text(cur)
    }
    if (!content) content = curTrs.length ? "Tool results provided." : "Continue"
  }

  const request: CWRequest = {
    conversationState: {
      chatTriggerType: TRIGGER,
      conversationId: conversation,
      currentMessage: {
        userInputMessage: { content, modelId: resolved, origin: ORIGIN },
      },
    },
  }
  if (auth.profileArn) request.profileArn = auth.profileArn

  // reconcile tool results with history
  const allIds = new Set(history.flatMap((h) => h.assistantResponseMessage?.toolUses || []).map((tu) => tu.toolUseId))
  const matched: any[] = []
  const orphaned: any[] = []
  for (const tr of curTrs) {
    if (allIds.has(tr.toolUseId)) {
      matched.push(tr)
    } else {
      const original = findToolCall(messages, tr.toolUseId)
      if (original) {
        orphaned.push({
          call: {
            name: original.name || original.function?.name || "tool",
            toolUseId: tr.toolUseId,
            input: original.input || (original.function?.arguments ? JSON.parse(original.function.arguments) : {}),
          },
          result: tr,
        })
      } else {
        content += `\n\n[Output for tool call ${tr.toolUseId}]:\n${tr.content?.[0]?.text || ""}`
      }
    }
  }
  if (orphaned.length > 0) {
    const prev = history[history.length - 1]
    if (!prev || prev.assistantResponseMessage) {
      history.push({ userInputMessage: { content: "Running tools...", modelId: resolved, origin: ORIGIN } })
    }
    history.push({
      assistantResponseMessage: {
        content: "I will execute the following tools.",
        toolUses: orphaned.map((o) => o.call),
      },
    })
    matched.push(...orphaned.map((o) => o.result))
  }

  if (history.length > 0) (request.conversationState as any).history = history
  const uim = request.conversationState.currentMessage.userInputMessage
  if (uim) {
    uim.content = content
    if (curImgs.length) uim.images = curImgs
    const ctx: any = {}
    if (matched.length) ctx.toolResults = dedup(matched)
    if (cwTools.length) ctx.tools = cwTools
    if (Object.keys(ctx).length) uim.userInputMessageContext = ctx
    if (historyHasTools(history)) {
      const names = toolNamesFromHistory(history)
      if (names.size > 0) {
        const existing = uim.userInputMessageContext?.tools || []
        const existingNames = new Set(existing.map((t: any) => t.toolSpecification?.name).filter(Boolean))
        const missing = Array.from(names).filter((n) => !existingNames.has(n))
        if (missing.length > 0) {
          const placeholders = missing.map((name) => ({
            toolSpecification: { name, description: "Tool", inputSchema: { json: { type: "object", properties: {} } } },
          }))
          if (!uim.userInputMessageContext) uim.userInputMessageContext = {}
          uim.userInputMessageContext.tools = [...existing, ...placeholders]
        }
      }
    }
  }

  const p = os.platform()
  const r = os.release()
  const nv = process.version.replace("v", "")
  const osn = p === "win32" ? `windows#${r}` : p === "darwin" ? `macos#${r}` : `${p}#${r}`
  const ua = `${UA_PREFIX} ua/2.1 os/${osn} lang/js md/nodejs#${nv} api/codewhisperer#3.738.0 m/E KiroIDE`
  const region = regionFromArn(auth.profileArn) ?? auth.region

  return {
    url: BASE_URL.replace("{{region}}", region),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${auth.access}`,
        "amz-sdk-invocation-id": crypto.randomUUID(),
        "amz-sdk-request": "attempt=1; max=1",
        "x-amzn-kiro-agent-mode": "vibe",
        "x-amz-user-agent": `${UA_PREFIX} KiroIDE`,
        "user-agent": ua,
        Connection: "close",
      },
      body: JSON.stringify(request),
    },
    streaming: true,
    model: resolved,
    conversation,
  }
}
