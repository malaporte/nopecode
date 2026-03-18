# Fork Rules

This repository is a fork of upstream OpenCode maintained at `malaporte/nopecode`. It intentionally shares the CLI name, config path, install path, and release asset names with upstream to minimize merge diff.

## Defaults

- Upstream repo: `anomalyco/opencode`
- Fork repo: `malaporte/nopecode`
- Upstream default branch: `dev`
- Common local layout in this repo: `origin=upstream`, `mine=fork`
- The skill must detect remotes instead of assuming those names

## Preserve These Rules

- Global config root is `~/.config/opencode` (same as upstream)
- Installed CLI path is `~/.opencode/bin/opencode` (same as upstream)
- Release CLI assets are named `opencode-*` (same as upstream)
- Project-local config conventions intentionally stay upstream-shaped, including `.opencode` and `opencode.json`

- Allowed providers are only `openai` and `github-copilot`
- Provider login must not surface blocked providers
- `github-copilot` models must exclude Grok variants

- Custom plugins are intentionally disabled
- The loader-side block for custom plugins must stay in place
- The user-facing warning for ignored configured plugins must stay in place
- Notification behavior should stay built into internal plugins

- CLI autoupdate is intentionally disabled by default
- Manual TUI update remains available through `/update` and `/upgrade`

- Fork release CI lives in `.github/workflows/publish-fork.yml`
- Upstream publish workflow behavior should stay separate

- Fork versions intentionally stay above `1000`
- Do not normalize them back to upstream-style low versions

- macOS signing currently tolerates non-Developer-ID fallback
- Do not reintroduce stricter signing assumptions without an explicit change request

## Conflict Hotspots

Check these areas first when merges get messy:

- install and uninstall flows
- build and packaging names
- release workflows and release asset names
- config path handling
- provider filtering and model lists
- plugin loading
- desktop-side CLI installation paths

## Security-Sensitive Areas

Treat upstream changes in these areas as requiring explicit review notes in the final summary:

- authentication, authorization, and account linking
- command execution, shelling out, and sandbox rules
- network fetches, remote downloads, and auto-update behavior
- install, upgrade, uninstall, and desktop-side sidecar delivery
- provider selection, model routing, and credential handling
- plugin loading, MCP integration, and tool exposure
- workflow permissions, release automation, and packaging or signing paths
