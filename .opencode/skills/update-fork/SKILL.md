---
name: update-fork
description: Update this nopecode fork from upstream OpenCode by integrating the latest upstream release tag into the fork, preserving fork-specific behavior, resolving conflicts, flagging incoming security-sensitive changes for deeper review, and preparing a PR-ready branch. Use when asked to sync this fork with upstream opencode, merge upstream changes, review upstream drift, assess upstream security impact, or prepare an upstream integration branch or PR.
---

# Update Fork

Use this skill when working on upstream integration for this repository.

## Workflow

1. Read `DIFFERENCES.md` at the repo root — it is the authoritative inventory of fork-specific behaviors that must be preserved. Then read `references/fork-rules.md` for conflict hotspots and security-sensitive area checklists.
2. Inspect git remotes and detect which remote is upstream OpenCode and which remote is the fork.
3. Confirm the upstream default branch is `dev`.
4. Fetch both fork and upstream before diffing or merging.
5. Identify the latest upstream release tag by running `git tag -l 'v[0-9]*' --sort=-version:refname | grep -v '^v1000' | head -1`. Report the tag and its commit to the user. If no upstream release tag is found, stop and report the problem.
6. Branch from the fork target branch, usually `dev`, unless the user names a different base.
7. Review the upstream delta (from the fork base to the release tag) before merging so conflict hotspots are obvious.
8. Identify incoming changes that warrant deeper security review before finalizing the merge.
9. Merge the latest upstream release tag into the fork branch. If the user explicitly asks to merge `dev` or a specific commit/tag, honour that request instead.
10. Resolve conflicts by preserving fork behavior unless the user explicitly asks to revert it.
11. Run focused validation in affected package directories.
12. Summarize what changed, which fork rules were preserved, which security-sensitive incoming changes need deeper review, and any remaining follow-up.

## Remote Detection

- Detect remotes from `git remote -v`; do not assume fixed names.
- Treat the remote pointing to `anomalyco/opencode` as upstream.
- Treat the remote pointing to `malaporte/nopecode` as the fork.
- If either remote is missing or ambiguous, stop and report the problem instead of guessing.
- Do not rename remotes unless the user explicitly asks for that cleanup.

## Merge Policy

- Prefer a normal merge of the latest upstream release tag (not bleeding-edge `dev`); do not rebase the fork by default.
- Create a dedicated work branch before merging.
- Keep merge history intact so fork-only changes stay easy to review.
- If the merge is trivial, still inspect touched fork hotspots before finalizing.
- If upstream changes require a product choice rather than a straightforward preservation choice, stop and ask the user.

## Conflict Policy

- Preserve all behaviors documented in `DIFFERENCES.md`. Prefer the fork implementation for any conflict touching those areas.
- Prefer upstream implementation when the change is unrelated to fork policy and does not break the fork.

## Security Review

- Review upstream changes for security-sensitive areas before finalizing the integration.
- Explicitly call out incoming changes touching auth, permissions, sandboxing, command execution, network access, update/install flows, plugin loading, secret handling, model/provider routing, or remote content fetch paths.
- Flag dependency, workflow, CI, packaging, and release-process changes that could affect supply chain risk.
- Flag any change that expands provider support, plugin capabilities, code execution surface, or external connectivity, because those conflict with fork policy and may need deeper review.
- If a change looks security-relevant but the impact is unclear, say so explicitly instead of silently accepting it.

## Validation

- Run `bun typecheck` from package directories for touched TypeScript packages.
- Run focused tests from package directories when the merge touches behavior with existing coverage.
- Do not run tests from the repo root.
- If validation cannot be completed, state exactly what was not run and why.

## Output

- Merge the incoming commits from upstream directly into main, do not squash.
- Report:
  - upstream release tag merged (and its commit range from the previous fork base)
  - conflicts resolved
  - fork-specific decisions preserved
  - security-sensitive incoming changes that need deeper review
  - validation run
  - remaining manual follow-up, if any
