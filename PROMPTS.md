# Prompt Token Audit

This note captures the prompt/token audit for the built `packages/opencode` prompt surface only.

Excluded from this audit:

- repo-root `AGENTS.md`
- repo-local steering/instructions
- local tools/commands specific to this worktree

## Scope

The active prompt stack for the shipped `opencode` build is assembled primarily from:

- `packages/opencode/src/session/system.ts`
- `packages/opencode/src/session/llm.ts`
- `packages/opencode/src/session/prompt/*.txt`
- `packages/opencode/src/tool/*.txt`

For this pass, I focused on the built-in provider prompts and built-in tool descriptions that are shipped from `packages/opencode`.

## Key findings

- The largest optimization opportunity is tool descriptions, not the base system prompt.
- The active core tool descriptions total about 7,282 tokens.
- The top 3 active tool descriptions alone account for about 5,562 tokens.
- The practical OpenAI hot paths are `beast.txt` and `codex.txt`.
- There appears to be dead weight from unreferenced or orphan prompt files.

## Built-in provider prompt sizes

Approximate token count uses `chars / 4`.

| File                                                     |  Chars | Approx tokens |
| -------------------------------------------------------- | -----: | ------------: |
| `packages/opencode/src/session/prompt/gemini.txt`        | 15,372 |         3,843 |
| `packages/opencode/src/session/prompt/copilot-gpt-5.txt` | 14,234 |         3,558 |
| `packages/opencode/src/session/prompt/beast.txt`         | 11,078 |         2,770 |
| `packages/opencode/src/session/prompt/default.txt`       |  8,661 |         2,165 |
| `packages/opencode/src/session/prompt/anthropic.txt`     |  8,212 |         2,053 |
| `packages/opencode/src/session/prompt/trinity.txt`       |  7,748 |         1,937 |
| `packages/opencode/src/session/prompt/codex.txt`         |  7,362 |         1,840 |

Notes:

- `packages/opencode/src/session/system.ts` currently selects `beast.txt` for `gpt-4`, `o1`, and `o3` models.
- `packages/opencode/src/session/system.ts` selects `codex.txt` for other `gpt*` models.
- `packages/opencode/src/session/prompt/copilot-gpt-5.txt` appears unreferenced in the current code path.

## Built-in tool description sizes

Approximate token count uses `chars / 4`.

| File                                         | Chars | Approx tokens |
| -------------------------------------------- | ----: | ------------: |
| `packages/opencode/src/tool/bash.txt`        | 9,603 |         2,401 |
| `packages/opencode/src/tool/todowrite.txt`   | 8,845 |         2,211 |
| `packages/opencode/src/tool/task.txt`        | 3,799 |           950 |
| `packages/opencode/src/tool/multiedit.txt`   | 2,406 |           602 |
| `packages/opencode/src/tool/edit.txt`        | 1,369 |           342 |
| `packages/opencode/src/tool/read.txt`        | 1,158 |           290 |
| `packages/opencode/src/tool/apply_patch.txt` | 1,092 |           273 |
| `packages/opencode/src/tool/lsp.txt`         | 1,040 |           260 |
| `packages/opencode/src/tool/batch.txt`       |   998 |           250 |
| `packages/opencode/src/tool/todoread.txt`    |   977 |           244 |
| `packages/opencode/src/tool/websearch.txt`   |   976 |           244 |
| `packages/opencode/src/tool/webfetch.txt`    |   750 |           188 |
| `packages/opencode/src/tool/grep.txt`        |   689 |           172 |
| `packages/opencode/src/tool/question.txt`    |   657 |           164 |
| `packages/opencode/src/tool/write.txt`       |   623 |           156 |
| `packages/opencode/src/tool/plan-enter.txt`  |   613 |           153 |
| `packages/opencode/src/tool/plan-exit.txt`   |   579 |           145 |
| `packages/opencode/src/tool/glob.txt`        |   545 |           136 |
| `packages/opencode/src/tool/ls.txt`          |   314 |            78 |

## Tool group totals

Active core tools I counted:

- `bash.txt`
- `read.txt`
- `glob.txt`
- `grep.txt`
- `edit.txt`
- `write.txt`
- `task.txt`
- `webfetch.txt`
- `todowrite.txt`
- `apply_patch.txt`
- `question.txt`

Totals:

- active core tools: 29,130 chars, about 7,282 tokens
- conditional tools (`websearch`, `codesearch`, `lsp`, `batch`, `plan-exit`): 4,395 chars, about 1,099 tokens
- orphan/dead-weight tools (`multiedit`, `todoread`, `plan-enter`, `ls`): 4,310 chars, about 1,078 tokens

Largest contributors among active tools:

- `packages/opencode/src/tool/bash.txt`: about 25.4% of active tool-description chars
- `packages/opencode/src/tool/todowrite.txt`: about 23.4%
- `packages/opencode/src/tool/task.txt`: about 10.0%

Together, those three files are about 58.8% of the active core tool-description payload.

## Main optimization opportunities

### 1. Shrink tool descriptions first

This is the highest-leverage change.

- `packages/opencode/src/tool/bash.txt` is the biggest single tool prompt and mixes core shell guidance with long git commit and PR workflows.
- `packages/opencode/src/tool/todowrite.txt` spends a lot of space on examples and reasoning that likely do not need to be in every request.
- `packages/opencode/src/tool/task.txt` is large for a routing tool and includes several illustrative examples that could move elsewhere.

Recommended approach:

- keep invocation-critical rules inline
- remove long examples from always-on tool descriptions
- move rare workflows into narrower prompts, docs, or on-demand instruction surfaces

### 2. Refactor OpenAI prompt hot paths

The most important shipped provider prompts for this fork are:

- `packages/opencode/src/session/prompt/beast.txt`
- `packages/opencode/src/session/prompt/codex.txt`

Recommended approach:

- extract a shared core prompt
- keep provider-specific deltas small
- remove stale or duplicated workflow language

### 3. Remove dead or unreferenced prompt files

Potential dead weight identified:

- `packages/opencode/src/session/prompt/copilot-gpt-5.txt` appears unreferenced in the current code path
- `packages/opencode/src/tool/multiedit.txt`
- `packages/opencode/src/tool/todoread.txt`
- `packages/opencode/src/tool/plan-enter.txt`
- `packages/opencode/src/tool/ls.txt`

These should be verified and then either deleted, excluded from bundling, or clearly marked as inactive.

## Practical priorities

Fastest wins first:

1. shrink `packages/opencode/src/tool/bash.txt`
2. shrink `packages/opencode/src/tool/todowrite.txt`
3. shrink `packages/opencode/src/tool/task.txt`
4. refactor `packages/opencode/src/session/prompt/beast.txt` and `packages/opencode/src/session/prompt/codex.txt`
5. delete or stop shipping unreferenced/orphan prompt files

## Important caveats

- This audit intentionally ignores repo-root and worktree-local steering.
- Token estimates are rough and based on character count, not provider tokenizer output.
- Some prompts may be conditional by provider, flags, or tool availability, so not every session pays every cost.
- `packages/opencode/src/tool/registry.ts` and `packages/opencode/src/session/system.ts` should be rechecked before deleting anything.
