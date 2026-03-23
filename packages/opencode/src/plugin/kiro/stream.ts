import { Log } from "../../util/log"

const log = Log.create({ service: "plugin.kiro.stream" })

const THINKING_START = "<thinking>"
const THINKING_END = "</thinking>"

interface StreamEvent {
  type: string
  message?: any
  content_block?: any
  delta?: any
  index?: number
  usage?: any
}

interface State {
  buffer: string
  inThinking: boolean
  extracted: boolean
  thinkingIdx: number | null
  textIdx: number | null
  nextIdx: number
  stopped: Set<number>
}

interface ToolState {
  toolUseId: string
  name: string
  input: string
}

function parseJson(line: string): any | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function parseBuffer(raw: string): { events: any[]; remaining: string } {
  const events: any[] = []
  let remaining = raw
  let pos = 0

  while (true) {
    const candidates = [
      remaining.indexOf('{"content":', pos),
      remaining.indexOf('{"name":', pos),
      remaining.indexOf('{"followupPrompt":', pos),
      remaining.indexOf('{"input":', pos),
      remaining.indexOf('{"stop":', pos),
      remaining.indexOf('{"contextUsagePercentage":', pos),
      remaining.indexOf('{"metadataEvent":', pos),
      remaining.indexOf('{"unit":', pos),
    ].filter((p) => p >= 0)
    if (candidates.length === 0) break

    const start = Math.min(...candidates)
    if (start < 0) break

    let braces = 0
    let end = -1
    let str = false
    let esc = false
    for (let i = start; i < remaining.length; i++) {
      const c = remaining[i]
      if (esc) {
        esc = false
        continue
      }
      if (c === "\\") {
        esc = true
        continue
      }
      if (c === '"') {
        str = !str
        continue
      }
      if (!str) {
        if (c === "{") braces++
        else if (c === "}") {
          braces--
          if (braces === 0) {
            end = i
            break
          }
        }
      }
    }

    if (end < 0) {
      remaining = remaining.substring(start)
      break
    }

    const parsed = parseJson(remaining.substring(start, end + 1))
    if (parsed) {
      if (parsed.content !== undefined && !parsed.followupPrompt) {
        events.push({ type: "content", data: parsed.content })
      } else if (parsed.name && parsed.toolUseId) {
        events.push({
          type: "toolUse",
          data: {
            name: parsed.name,
            toolUseId: parsed.toolUseId,
            input: parsed.input || "",
            stop: parsed.stop || false,
          },
        })
      } else if (parsed.input !== undefined && !parsed.name) {
        events.push({ type: "toolUseInput", data: { input: parsed.input } })
      } else if (parsed.stop !== undefined && parsed.contextUsagePercentage === undefined) {
        events.push({ type: "toolUseStop", data: { stop: parsed.stop } })
      } else if (parsed.contextUsagePercentage !== undefined) {
        events.push({ type: "contextUsage", data: { contextUsagePercentage: parsed.contextUsagePercentage } })
      } else if (parsed.metadataEvent) {
        events.push({ type: "metadata", data: parsed.metadataEvent })
      } else if (parsed.unit && parsed.usage !== undefined) {
        events.push({ type: "metering", data: { unit: parsed.unit, usage: parsed.usage } })
      }
    }

    pos = end + 1
    if (pos >= remaining.length) {
      remaining = ""
      break
    }
  }

  if (pos > 0 && remaining.length > 0) remaining = remaining.substring(pos)
  return { events, remaining }
}

function findTag(buffer: string, tag: string): number {
  const blocks: Array<[number, number]> = []
  const pattern = /```[\s\S]*?```/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(buffer)) !== null) blocks.push([m.index, m.index + m[0].length])

  let p = 0
  while ((p = buffer.indexOf(tag, p)) !== -1) {
    if (!blocks.some(([s, e]) => p >= s && p < e)) return p
    p += tag.length
  }
  return -1
}

function ensureBlock(kind: "thinking" | "text", state: State): StreamEvent[] {
  if (kind === "thinking") {
    if (state.thinkingIdx != null) return []
    const idx = state.nextIdx++
    state.thinkingIdx = idx
    return [{ type: "content_block_start", index: idx, content_block: { type: "thinking", thinking: "" } }]
  }
  if (state.textIdx != null) return []
  const idx = state.nextIdx++
  state.textIdx = idx
  return [{ type: "content_block_start", index: idx, content_block: { type: "text", text: "" } }]
}

function stopBlock(idx: number | null, state: State): StreamEvent[] {
  if (idx == null || state.stopped.has(idx)) return []
  state.stopped.add(idx)
  return [{ type: "content_block_stop", index: idx }]
}

function textDelta(t: string, state: State): StreamEvent[] {
  if (!t) return []
  return [
    ...ensureBlock("text", state),
    { type: "content_block_delta", index: state.textIdx!, delta: { type: "text_delta", text: t } },
  ]
}

function thinkDelta(t: string, state: State): StreamEvent[] {
  return [
    ...ensureBlock("thinking", state),
    { type: "content_block_delta", index: state.thinkingIdx!, delta: { type: "thinking_delta", thinking: t } },
  ]
}

function toOpenAI(event: StreamEvent, id: string, model: string): any {
  const base: any = { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [] }

  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") {
      base.choices.push({ index: 0, delta: { content: event.delta.text }, finish_reason: null })
    } else if (event.delta.type === "thinking_delta") {
      base.choices.push({ index: 0, delta: { reasoning_content: event.delta.thinking }, finish_reason: null })
    } else if (event.delta.type === "input_json_delta") {
      base.choices.push({
        index: 0,
        delta: { tool_calls: [{ index: event.index, function: { arguments: event.delta.partial_json } }] },
        finish_reason: null,
      })
    }
  } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
    base.choices.push({
      index: 0,
      delta: {
        tool_calls: [
          {
            index: event.index,
            id: event.content_block.id,
            type: "function",
            function: { name: event.content_block.name, arguments: "" },
          },
        ],
      },
      finish_reason: null,
    })
  } else if (event.type === "message_delta") {
    base.choices.push({
      index: 0,
      delta: {},
      finish_reason: event.delta.stop_reason === "tool_use" ? "tool_calls" : "stop",
    })
    base.usage = {
      prompt_tokens: event.usage?.input_tokens || 0,
      completion_tokens: event.usage?.output_tokens || 0,
      total_tokens: (event.usage?.input_tokens || 0) + (event.usage?.output_tokens || 0),
      prompt_tokens_details: {
        cached_tokens: event.usage?.cache_read_input_tokens || 0,
      },
      cache_creation_input_tokens: event.usage?.cache_creation_input_tokens || 0,
    }
  }

  return base
}

function parseBracketTools(raw: string): ToolState[] {
  const result: ToolState[] = []
  const pattern = /\[Called\s+(\w+)\s+with\s+args:\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})\]/gs
  let m: RegExpExecArray | null
  while ((m = pattern.exec(raw)) !== null) {
    if (!m[1] || !m[2]) continue
    try {
      const args = JSON.parse(m[2])
      result.push({
        toolUseId: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: m[1],
        input: JSON.stringify(args),
      })
    } catch {
      continue
    }
  }
  return result
}

export async function* transformStream(response: Response, model: string, conversation: string): AsyncGenerator<any> {
  const state: State = {
    buffer: "",
    inThinking: false,
    extracted: false,
    thinkingIdx: null,
    textIdx: null,
    nextIdx: 0,
    stopped: new Set(),
  }

  if (!response.body) throw new Error("Response body is null")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let raw = ""
  let total = ""
  let output = 0
  let input = 0
  let contextPct: number | null = null
  let cacheRead = 0
  let cacheWrite = 0
  let credits = 0
  const calls: ToolState[] = []
  let current: ToolState | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      raw += decoder.decode(value, { stream: true })
      const parsed = parseBuffer(raw)
      raw = parsed.remaining

      for (const event of parsed.events) {
        if (event.type === "contextUsage" && event.data.contextUsagePercentage) {
          contextPct = event.data.contextUsagePercentage
        } else if (event.type === "metering" && event.data) {
          credits += event.data.usage || 0
        } else if (event.type === "metadata" && event.data) {
          if (event.data.cache_read_input_tokens) cacheRead += event.data.cache_read_input_tokens
          if (event.data.cache_write_input_tokens) cacheWrite += event.data.cache_write_input_tokens
          if (event.data.input_tokens) input = event.data.input_tokens
          if (event.data.output_tokens) output = event.data.output_tokens
        } else if (event.type === "content" && event.data) {
          total += event.data
          state.buffer += event.data
          const deltas: StreamEvent[] = []

          while (state.buffer.length > 0) {
            if (!state.inThinking && !state.extracted) {
              const startPos = findTag(state.buffer, THINKING_START)
              if (startPos !== -1) {
                const before = state.buffer.slice(0, startPos)
                if (before) deltas.push(...textDelta(before, state))
                state.buffer = state.buffer.slice(startPos + THINKING_START.length)
                state.inThinking = true
                continue
              }
              const safe = Math.max(0, state.buffer.length - THINKING_START.length)
              if (safe > 0) {
                deltas.push(...textDelta(state.buffer.slice(0, safe), state))
                state.buffer = state.buffer.slice(safe)
              }
              break
            }

            if (state.inThinking) {
              const endPos = findTag(state.buffer, THINKING_END)
              if (endPos !== -1) {
                const part = state.buffer.slice(0, endPos)
                if (part) deltas.push(...thinkDelta(part, state))
                state.buffer = state.buffer.slice(endPos + THINKING_END.length)
                state.inThinking = false
                state.extracted = true
                deltas.push(...thinkDelta("", state))
                deltas.push(...stopBlock(state.thinkingIdx, state))
                if (state.buffer.startsWith("\n\n")) state.buffer = state.buffer.slice(2)
                continue
              }
              const safe = Math.max(0, state.buffer.length - THINKING_END.length)
              if (safe > 0) {
                deltas.push(...thinkDelta(state.buffer.slice(0, safe), state))
                state.buffer = state.buffer.slice(safe)
              }
              break
            }

            if (state.extracted) {
              const rest = state.buffer
              state.buffer = ""
              if (rest) deltas.push(...textDelta(rest, state))
              break
            }
          }

          for (const ev of deltas) yield toOpenAI(ev, conversation, model)
        } else if (event.type === "toolUse") {
          const tc = event.data
          if (tc.name) total += tc.name
          if (tc.input) total += tc.input
          if (tc.name && tc.toolUseId) {
            if (current && current.toolUseId === tc.toolUseId) {
              current.input += tc.input || ""
            } else {
              if (current) calls.push(current)
              current = { toolUseId: tc.toolUseId, name: tc.name, input: tc.input || "" }
            }
            if (tc.stop && current) {
              calls.push(current)
              current = null
            }
          }
        } else if (event.type === "toolUseInput") {
          if (event.data.input) total += event.data.input
          if (current) current.input += event.data.input || ""
        } else if (event.type === "toolUseStop") {
          if (current && event.data.stop) {
            calls.push(current)
            current = null
          }
        }
      }
    }

    if (current) {
      calls.push(current)
      current = null
    }

    // flush remaining buffer
    if (state.buffer) {
      if (state.inThinking) {
        for (const ev of thinkDelta(state.buffer, state)) yield toOpenAI(ev, conversation, model)
        state.buffer = ""
        for (const ev of thinkDelta("", state)) yield toOpenAI(ev, conversation, model)
        for (const ev of stopBlock(state.thinkingIdx, state)) yield toOpenAI(ev, conversation, model)
      } else {
        for (const ev of textDelta(state.buffer, state)) yield toOpenAI(ev, conversation, model)
        state.buffer = ""
      }
    }

    for (const ev of stopBlock(state.textIdx, state)) yield toOpenAI(ev, conversation, model)

    // bracket tool calls fallback
    const bracket = parseBracketTools(total)
    if (bracket.length > 0) calls.push(...bracket)

    // emit tool call blocks
    if (calls.length > 0) {
      const base = state.nextIdx
      for (let i = 0; i < calls.length; i++) {
        const tc = calls[i]
        if (!tc) continue
        const idx = base + i
        let json: string
        try {
          json = JSON.stringify(JSON.parse(tc.input))
        } catch {
          json = tc.input
        }
        yield toOpenAI(
          {
            type: "content_block_start",
            index: idx,
            content_block: { type: "tool_use", id: tc.toolUseId, name: tc.name, input: {} },
          },
          conversation,
          model,
        )
        yield toOpenAI(
          { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: json } },
          conversation,
          model,
        )
        yield toOpenAI({ type: "content_block_stop", index: idx }, conversation, model)
      }
    }

    // fallback token estimation from contextUsagePercentage when metadata is absent
    if (!output) output = Math.ceil(total.length / 4)
    if (!input && contextPct !== null && contextPct > 0) {
      const tokens = Math.round((200000 * contextPct) / 100)
      input = Math.max(0, tokens - output)
    }

    log.info("stream usage", { input, output, cacheRead, cacheWrite, credits, contextPct })

    yield toOpenAI(
      {
        type: "message_delta",
        delta: { stop_reason: calls.length > 0 ? "tool_use" : "end_turn" },
        usage: {
          input_tokens: input,
          output_tokens: output,
          cache_creation_input_tokens: cacheWrite,
          cache_read_input_tokens: cacheRead,
        },
      },
      conversation,
      model,
    )
    yield toOpenAI({ type: "message_stop" }, conversation, model)
  } finally {
    reader.releaseLock()
  }
}
