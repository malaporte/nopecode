# Kiro / CodeWhisperer API Integration

Internal reference for developers working on the Kiro provider plugin.

## API overview

The Kiro provider talks to the AWS CodeWhisperer `generateAssistantResponse` API at `https://q.{region}.amazonaws.com/generateAssistantResponse`.

Requests use OpenAI format internally. `request.ts` transforms them to CW format, and `stream.ts` transforms the response stream back to OpenAI SSE format. Auth is OAuth via AWS Builder ID or IAM Identity Center (device code flow).

## Wire format

The response stream uses AWS Event Stream binary encoding, not plain JSON.

Event types observed in the stream (identified by the `:event-type` binary header):

| Event                    | Payload                                                     | Notes                            |
| ------------------------ | ----------------------------------------------------------- | -------------------------------- |
| `assistantResponseEvent` | `{"content":"...","modelId":"..."}`                         | Content tokens                   |
| `contextUsageEvent`      | `{"contextUsagePercentage": <float>}`                       | Percentage of model context used |
| `meteringEvent`          | `{"unit":"credit","unitPlural":"credits","usage": <float>}` | Credit cost for the request      |

Tool use events arrive as JSON objects with `name`, `toolUseId`, `input`, and `stop` fields.

No `metadataEvent` or token-level cache breakdown is returned by the API (as of March 2026).

## Prompt caching (cachePoint)

Source: confirmed from `github.com/aws/amazon-q-developer-cli` Rust source.

`CachePoint` is a request-side declarative annotation: `{"type": "default"}`. It is placed on `userInputMessage.cachePoint` and `assistantResponseMessage.cachePoint` in the history array to tell the server to cache the KV-cache prefix up to that message.

On subsequent requests with the same `conversationId` and matching message prefix, the server reuses the cached KV state.

Model config from `ListAvailableModels` includes: `supportsPromptCaching`, `minimumTokensPerCacheCheckpoint`, `maximumCacheCheckpointsPerRequest`.

Our implementation places up to 2 cache points:

1. **First user message** (contains the system prompt) -- caches the expensive system prompt prefix
2. **Last assistant message** before the new turn -- caches the full conversation history

Credit costs dropped ~40-45% from turn 3 onward in testing (0.075 credits to 0.042-0.047 credits), confirming server-side caching is effective. The server does NOT return token-level cache metrics (e.g. `cache_read_input_tokens`) -- the only way to verify caching is via `meteringEvent` credit cost reduction.

## ConversationId reuse

Each opencode session ID maps to a persistent `conversationId` (UUID) via the `conversations` Map in `kiro.ts`. The session ID is passed through via the `x-kiro-session` HTTP header from `llm.ts`.

Full message history is ALWAYS sent regardless of whether the conversationId is reused. The API is stateless -- conversationId is only a cache key hint.

On API error, the conversationId is invalidated so the next request starts fresh. An earlier approach that skipped history on reuse was incorrect and was reverted.

## Token usage estimation

The API does not return input/output token counts directly.

`contextUsagePercentage` from `contextUsageEvent` is used to estimate input tokens:

```
input = round(200000 * contextPct / 100) - output
```

Output tokens are estimated as `ceil(total_chars / 4)`.

These are fallback estimates. If a future `metadataEvent` provides real token counts, those take priority (the code is forward-compatible).

Credit cost from `meteringEvent` is logged but not yet surfaced in the TUI.

## Cache metrics plumbing (forward-compatible)

`stream.ts` parses `metadataEvent` for `cache_read_input_tokens`, `cache_write_input_tokens`, `input_tokens`, `output_tokens`.

`toOpenAI()` emits cache read via `prompt_tokens_details.cached_tokens` (OpenAI format) and cache write via `cache_creation_input_tokens`.

The copilot SDK consumer (`openai-compatible-chat-language-model.ts`) extracts these and maps:

- Cache read: `prompt_tokens_details.cached_tokens` -> `LanguageModelV2Usage.cachedInputTokens` -> `Session.getUsage().tokens.cache.read`
- Cache write: `cache_creation_input_tokens` -> `providerMetadata.anthropic.cacheCreationInputTokens` -> `Session.getUsage().tokens.cache.write`

This pipeline is wired end-to-end but currently reports 0 because the API doesn't send these fields yet.

## Key files

| File         | Role                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `request.ts` | OpenAI -> CW request transformer. Builds history, injects system prompt, adds cachePoint annotations, handles tool reconciliation.           |
| `stream.ts`  | CW -> OpenAI response stream transformer. Parses AWS Event Stream, extracts thinking blocks, handles tool use events, estimates token usage. |
| `kiro.ts`    | Auth plugin with custom fetch interceptor. OAuth token refresh, conversationId reuse, model discovery via `ListAvailableModels`.             |
| `llm.ts`     | Injects `x-kiro-session` and `x-kiro-suffix` headers for session mapping and thinking mode.                                                  |

## Other fields discovered (not yet used)

- `UserInputMessage.clientCacheConfig` -- `{"useClientCachingOnly": true/false}` -- may control caching behavior, not currently set
- `supplementaryWebLinks` -- discovered in binary, purpose unknown
- `PromptCaching` model config: `supportsPromptCaching`, `minimumTokensPerCacheCheckpoint`, `maximumCacheCheckpointsPerRequest` -- returned by `ListAvailableModels`, could be used to dynamically decide cache point placement
