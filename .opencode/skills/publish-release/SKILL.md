---
name: publish-release
description: Publish a new nopecode release by bumping the version in packages/opencode/package.json, committing, tagging, and pushing to trigger the publish-fork.yml CI pipeline. Use when asked to cut a release, publish a new version, tag a release, or bump and release.
---

## Purpose

Walk through creating a new nopecode release: inspect commits since the last tag
to recommend a semver bump, update `packages/opencode/package.json`, commit, tag,
and push to trigger `publish-fork.yml`.

Fork version numbers must stay above `1000`. No npm, Docker, AUR, or Homebrew
publish happens — the CI pipeline produces GitHub release assets only.

## Version Rules

This project follows [Semantic Versioning](https://semver.org/) and
[Conventional Commits](https://www.conventionalcommits.org/). The highest-priority
rule across all commits since the last tag wins.

| Commits since last tag                           | Bump                             |
| ------------------------------------------------ | -------------------------------- |
| Any `!` suffix or `BREAKING CHANGE:` in body     | **major** (`X.0.0`)              |
| Any `feat:`                                      | **minor** (`x.Y.0`)              |
| Any `fix:`, `perf:`, `refactor:`                 | **patch** (`x.y.Z`)              |
| Only `docs:`, `chore:`, `ci:`, `test:`, `style:` | **patch** (or consider skipping) |

Fork version floor: the resulting version must always be `>= 1000.0.0`. Never
produce a version below `1000`.

## Instructions

### Step 1: Guard — Check for Uncommitted Changes

```bash
git status --porcelain
```

If the output is non-empty, **stop** and ask the user to commit or stash their
changes before proceeding.

### Step 2: Read the Current Version

```bash
cat packages/opencode/package.json
```

Extract the `"version"` field (e.g. `"1000.7.0"`). Store this as `{current_version}`.

### Step 3: Find the Last Tag and Inspect Commits

```bash
git describe --tags --abbrev=0
```

Store the result as `{last_tag}` (e.g. `v1000.7.0`).

If no tag exists, skip ahead to Step 4 and ask the user to provide the full
version number manually.

List commits since the last tag:

```bash
git log {last_tag}..HEAD --oneline
```

If there are **no commits** since the last tag, **stop** and inform the user:

```
No commits found since {last_tag}. There is nothing to release.
```

Otherwise, apply the version rules above to determine the recommended bump type.
Present your reasoning clearly, for example:

```
Current version : 1000.7.0
Commits since v1000.7.0:
  a1b43d5 feat: add new provider routing
  366ade7 fix: correct model fallback

Analysis:
  - 1 × feat  → minor bump recommended

Recommended next version: 1000.8.0  (minor bump)
```

Ask the user to confirm or provide a different version before continuing.
Store the confirmed version as `{new_version}` (without the `v` prefix, e.g. `1000.8.0`).

Verify `{new_version}` is `>= 1000.0.0`. If not, **stop** and warn the user.

### Step 4: Update packages/opencode/package.json

Edit `packages/opencode/package.json`, changing the `"version"` field from
`{current_version}` to `{new_version}`.

Do **not** update any other `package.json` files — the CI pipeline stamps all
other packages with the new version automatically during the publish step.

Verify the change looks correct before committing.

### Step 5: Update bun.lock

The lockfile embeds the version from `packages/opencode/package.json`. Regenerate
it so the two stay in sync:

```bash
bun install
```

Verify that `bun.lock` shows the new version, then stage it alongside the
package file.

### Step 6: Commit the Version Bump

```bash
git add packages/opencode/package.json bun.lock
git commit -m "chore: bump version to v{new_version}"
```

### Step 7: Create the Git Tag

Check that the tag does not already exist:

```bash
git tag | grep "^v{new_version}$"
```

If a match is found, **stop** and warn the user before proceeding.

Otherwise create the tag:

```bash
git tag v{new_version}
```

### Step 8: Push Commit and Tag

```bash
git push && git push --tags
```

### Step 9: Confirm

Report success:

```
Released v{new_version}.

The tag push has triggered publish-fork.yml, which will build CLI binaries
for all platforms, assemble desktop installers, and publish the GitHub release.
```

## Notes

- **Version floor:** fork versions must always be `>= 1000.0.0` to distinguish
  them from upstream OpenCode releases.
- **Only one file to update:** `packages/opencode/package.json` is the sole
  version source of truth. CI stamps all other packages automatically. The
  `bun.lock` file must also be regenerated after bumping so it stays in sync.
- **Workflow guard:** `publish-fork.yml` has `if: github.repository == 'malaporte/nopecode'`
  — it will not run if the tag is pushed to a fork of the fork.
- **GitHub-only release:** no npm, Docker image, AUR, or Homebrew formula is
  updated. The release consists entirely of GitHub release assets.
- **Expected CLI assets:** the finalize step in CI verifies all 11 CLI archives
  exist before publishing the draft release:
  `opencode-linux-arm64.tar.gz`, `opencode-linux-x64.tar.gz`,
  `opencode-linux-x64-baseline.tar.gz`, `opencode-linux-arm64-musl.tar.gz`,
  `opencode-linux-x64-musl.tar.gz`, `opencode-linux-x64-baseline-musl.tar.gz`,
  `opencode-darwin-arm64.zip`, `opencode-darwin-x64.zip`,
  `opencode-darwin-x64-baseline.zip`, `opencode-windows-x64.zip`,
  `opencode-windows-x64-baseline.zip`.
- **CLI autoupdate:** autoupdate is disabled by default in this fork. Users
  install new versions manually; the `/update` and `/upgrade` TUI commands
  remain available for manual in-app updates.
