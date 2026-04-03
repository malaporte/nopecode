# Fork Differences from Upstream OpenCode

This document inventories every intentional divergence between this fork (`malaporte/nopecode`) and upstream OpenCode. The fork version line starts at **1000** to avoid confusion with upstream releases.

Target audience: contributors and AI agents merging upstream changes. Each section names the affected files, describes what changed, and states what must be preserved.

---

## 1. Provider Restrictions

**Files:** `packages/opencode/src/provider/provider.ts`, `packages/opencode/src/cli/cmd/providers.ts`, `packages/opencode/src/provider/schema.ts`

Only `openai`, `github-copilot`, and `kiro` are allowed. All other providers are filtered out at two enforcement points:

- `provider.ts`: `isProviderAllowed()` checks against a hardcoded `allowed` set before loading any provider. Plugin-provided providers are also filtered through the same set.
- `providers.ts` (login UI): the provider list shown to the user is filtered to the same allowlist, including plugin-contributed providers.
- Grok model variants are excluded from `github-copilot` via `isModelAllowed()`.
- `ProviderID.kiro` is added to `schema.ts`.

**Test bypass:** `OPENCODE_ALLOW_ALL_PROVIDERS=1` env var skips the allowlist so upstream provider tests pass unmodified.

**Preserve:** both enforcement points, the `isModelAllowed` grok filter, the env bypass, and `ProviderID.kiro` in the schema.

---

## 2. Kiro Provider

**Files:** `packages/opencode/src/plugin/kiro.ts`, `packages/opencode/src/plugin/kiro/` (request and stream transform helpers), `packages/opencode/src/provider/provider.ts`

A new provider not present in models.dev, injected directly into the provider database at startup:

- **Auth plugin** (`KiroAuthPlugin`): supports two auth flows — Builder ID (desktop OAuth via `prod.<region>.auth.desktop.kiro.dev`) and IAM Identity Center (AWS OIDC). Handles token refresh, credential encoding, and auto-provisioning on first load. Added to `INTERNAL_PLUGINS` in `plugin/index.ts`.
- **Model list**: loaded dynamically from the instance directory; falls back to a hardcoded `KIRO_MODELS` constant. Models are injected into the provider database with capabilities, context limits, and thinking-model detection (`canThink` checks for `sonnet`/`opus` in the model name).
- **Credits metadata**: a custom `metadataExtractor` on the provider accumulates `kiro.credits` from streaming chunks and surfaces them as part metadata.
- **Cost display**: when the last assistant message has `providerID === "kiro"`, cost is shown as `✦N.NN` (credits) instead of the standard `$N.NN` currency format. This applies in both the session header (`header.tsx`) and the sidebar (`sidebar.tsx`).
- **Variants**: kiro models bypass `ProviderTransform.variants()` and use their own variant map set during injection.
- **`Provider.db()`**: a new export that exposes the raw provider database (needed by kiro model loading).

**Preserve:** the entire `plugin/kiro.ts` and `plugin/kiro/` directory, the injection block in `provider.ts`, the `✦` cost display branches, `ProviderID.kiro` in schema, and the `db()` export.

---

## 3. Custom Plugins Disabled

**Files:** `packages/opencode/src/plugin/index.ts`

The npm plugin loading loop is removed. If a user has plugins configured:

- A warning is logged.
- A `TuiEvent.ToastShow` bus event is published with a "Plugins ignored" message.
- The TUI shows a one-time dismissible dialog on startup (`app.tsx`, gated by a KV flag `plugins_ignored_warning`).

`PoeAuthPlugin` is removed from `INTERNAL_PLUGINS`. `KiroAuthPlugin` and `NotifyPlugin` are added in its place.

**Preserve:** the disabled-loader block and the warning/toast. Do not re-enable custom plugin loading when merging upstream changes that touch `plugin/index.ts`.

---

## 4. Built-in Notification Plugin

**Files:** `packages/opencode/src/plugin/notify.ts`

An OS notification plugin shipped as a built-in (not user-installable). On macOS it prefers `terminal-notifier` so clicking a notification activates the terminal. Notifications are skipped for subagent sessions.

Added to `INTERNAL_PLUGINS` in `plugin/index.ts`.

**Preserve:** `notify.ts` and its entry in `INTERNAL_PLUGINS`.

---

## 5. Sandbox / Pippin Integration

**Files:** `packages/opencode/src/tool/bash.ts`, `packages/opencode/src/tool/bash.txt`, `packages/opencode/src/agent/agent.ts`, `packages/opencode/src/cli/cmd/tui/context/sync.tsx`, `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx`, `packages/opencode/src/cli/cmd/tui/app.tsx`, `packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`, `packages/opencode/src/cli/cmd/tui/routes/session/permission.tsx`

Bash commands are optionally routed through a sandbox process (`pippin -c <command>`) when `config.sandbox.enabled !== false`:

- **Bash tool** (`bash.ts`): gains two new parameters — `unsandboxed` (boolean) and `unsandboxed_reason` (string). When `unsandboxed: true` is requested, the tool calls `ctx.ask()` with permission `unsandboxed_bash` before running the command on the host. The description is built with six `replaceAll` substitutions: `${directory}`, `${os}`, `${shell}`, `${chaining}`, `${maxLines}`, `${maxBytes}` — all six must be present or the model receives garbled instructions.
- **Bash tool description** (`bash.txt`): contains a `# Sandbox` section explaining the sandbox to the model and when to use `unsandboxed`. The wording must clarify that the sandbox **has network access** (to prevent preemptive `unsandboxed` requests) and include an explicit rule against requesting `unsandboxed` before a command has actually failed. This section must be preserved on every merge — its absence silently breaks the unsandboxed escape hatch.
- **Agent defaults** (`agent.ts`): `unsandboxed_bash: "ask"` is added to the `defaults` permission ruleset **after** the `"*": "allow"` wildcard entry. This is critical — `Permission.evaluate` uses `findLast`, so without this explicit entry the wildcard silently auto-allows all `unsandboxed_bash` requests, bypassing the user confirmation prompt entirely. Every upstream merge that touches `agent.ts` must verify this entry is still present and still positioned after `"*": "allow"`.
- **Permission prompt** (`permission.tsx`): handles the `unsandboxed_bash` permission type, displaying the reason and command to the user.
- **TUI prompt indicator** (`prompt/index.tsx`): a clickable "◆ Sandbox on / ◇ Sandbox off" hint is shown in the prompt hints row. Color reflects state (green = on, yellow = off).
- **`/sandbox` slash command** (`app.tsx`): toggles `config.sandbox.enabled` via the SDK and updates the sync store optimistically.
- **Sandbox errors sidebar** (`sidebar.tsx`, `sync.tsx`): failed sandboxed commands (non-zero exit, not `unsandboxed`) are tracked in `sync.data.sandbox_errors` per session (capped at 20). The sidebar shows a collapsible "Sandbox Errors" section with command, exit code, and output. A clear button calls `sync.clearSandboxErrors()`.

> **SECURITY NOTE — do not lose these on merges:**
>
> 1. `unsandboxed_bash: "ask"` in `agent.ts` defaults (after `"*": "allow"`). Without it, the model can run any command on the host without user confirmation.
> 2. All six `replaceAll` substitutions in `bash.ts` description building (`${os}`, `${shell}`, `${chaining}` were dropped by upstream's Effect refactor in `e4ff1ea77` and must be restored after every merge that touches `bash.ts`).
> 3. The `# Sandbox` section in `bash.txt`.

**Preserve:** all sandbox-related params on the bash tool, all six description substitutions in `bash.ts`, the `unsandboxed_bash: "ask"` default in `agent.ts`, the `# Sandbox` section in `bash.txt`, the `unsandboxed_bash` permission handler, the prompt indicator, the `/sandbox` command, and the sandbox errors sidebar/sync state.

---

## 6. Auto-update Disabled by Default

**Files:** `packages/opencode/src/cli/upgrade.ts`, `packages/opencode/src/cli/cmd/tui/app.tsx`

Upstream defaults `autoupdate` to `true` (opt-out). This fork defaults it to `false` (opt-in):

```ts
const autoupdate = config.autoupdate ?? false
```

This prevents the fork binary from silently replacing itself with an older upstream release fetched from `anomalyco/opencode`. Updates are sourced exclusively from the fork repo (`malaporte/nopecode`) — both the `install` script and the update check target the fork's GitHub releases, not upstream.

Manual update is available via `/update` (also aliased as `/upgrade`) in the TUI, which calls `Installation.upgrade()` and prompts the user to restart.

**Preserve:** the `?? false` default and the comment explaining it. Do not revert to `?? true` when merging upstream changes to `upgrade.ts`.

---

## 7. TUI: Prose Width / Centered Layout

**Files:** `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx`

A `max_prose_width` key in the `tui` config section constrains the content column width. When set, content is centered horizontally within the terminal:

- `proseWidth` and `proseMargin` memos are computed from `max_prose_width` and the available `contentWidth`.
- Both values are exposed on the session context and applied to all message components: user messages, assistant messages, text parts, reasoning parts, inline tool calls, error boxes, and the subagent hint.
- The input/permission box at the bottom is also constrained to `proseWidth`.
- `footer.tsx` is removed; its content was folded into the session layout.

**Preserve:** `proseWidth`/`proseMargin` memos, the context fields, and all `width={ctx.proseWidth} marginLeft={ctx.proseMargin}` props when merging upstream changes to `session/index.tsx`.

---

## 8. Logo

**Files:** `packages/opencode/src/cli/logo.ts`

The left logo art has a different character arrangement (the four-character block columns are reordered). This is a cosmetic fork identity change.

**Preserve:** the modified `left` array value.

---

## 9. CI / Release Pipeline

**Files:** `.github/workflows/publish-fork.yml`, `.github/workflows/semantic-release.yml`, `.releaserc.json`, `install`

- **`publish-fork.yml`**: fork-specific release workflow. Triggers on `v*` tags targeting `malaporte/nopecode`. Builds CLI binaries on macOS (with Developer ID signing, tolerating fallback), uploads assets to the fork's GitHub releases. Completely separate from upstream's publish workflow.
- **`semantic-release.yml`** + **`.releaserc.json`**: automated version bumping and changelog generation. Commits version bumps with `[skip ci]` to avoid loops.
- **`install` script**: `REPO` is set to `malaporte/nopecode`. All download URLs and version checks point to the fork's releases, not `anomalyco/opencode`.
- **Removed upstream workflows**: `beta.yml`, `close-stale-prs.yml`, `compliance-close.yml`, `daily-issues-recap.yml`, `daily-pr-recap.yml`, `docs-update.yml`, `stats.yml` — none are applicable to the fork.
- **Version line**: fork versions stay above `1000`. Do not normalize these back to upstream version numbers.

**Preserve:** `publish-fork.yml`, `semantic-release.yml`, `.releaserc.json`, the `REPO` variable in `install`, and the `1000+` version line.

---

## 10. Skills & Agent Config

**Files:** `.opencode/skills/publish-release/SKILL.md`, `.opencode/skills/update-fork/SKILL.md`, `.opencode/skills/update-fork/references/fork-rules.md`, `AGENTS.md`

- **`publish-release` skill**: step-by-step instructions for cutting a fork release (bump version, commit, tag, push to trigger `publish-fork.yml`).
- **`update-fork` skill**: instructions for merging the latest upstream release tag into the fork, resolving conflicts, and preserving fork-specific behavior. References `fork-rules.md` for a checklist of what must be preserved.
- **`AGENTS.md`**: fork-specific rules for AI agents — branch notes, provider policy, plugin policy, auto-update policy, version numbering, signing, and style guide.

**Preserve:** all files under `.opencode/skills/` and the fork-specific sections of `AGENTS.md`.

---

## 11. README

**Files:** `README.md`

A "What Is This Fork?" section is prepended, explaining the fork's purpose and narrowed feature set. A dedicated "Install This Fork" section provides the correct `curl` command pointing to `malaporte/nopecode`. Upstream installation instructions are clearly labeled as upstream to avoid confusion.

**Preserve:** the fork intro, the fork install command, and the upstream labeling when merging upstream README changes.
