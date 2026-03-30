# Fork Rules

This repository is a fork of upstream OpenCode maintained at `malaporte/nopecode`. It intentionally shares the CLI name, config path, install path, and release asset names with upstream to minimize merge diff.

## Defaults

- Upstream repo: `anomalyco/opencode`
- Fork repo: `malaporte/nopecode`
- Upstream default branch: `dev`
- Common local layout in this repo: `origin=upstream`, `mine=fork`
- The skill must detect remotes instead of assuming those names

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
