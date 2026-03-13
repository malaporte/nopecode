#!/usr/bin/env bun

import { $ } from "bun"

const upstream = process.env.UPSTREAM_REPO || "anomalyco/opencode"
const base = process.env.SYNC_BASE || "custom"
const head = process.env.SYNC_HEAD || "sync/upstream-release"
const tag = process.env.UPSTREAM_TAG || ""
const repo = process.env.GITHUB_REPOSITORY || ""

async function has(list: string, value: string) {
  return list
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .includes(value)
}

async function latest() {
  if (tag) return tag
  const out = await $`gh release list --repo ${upstream} --limit 20 --json tagName,isDraft,isPrerelease`.text()
  const list = JSON.parse(out) as Array<{ tagName: string; isDraft: boolean; isPrerelease: boolean }>
  const hit = list.find((x) => !x.isDraft && !x.isPrerelease && /^v\d+\.\d+\.\d+/.test(x.tagName))
  if (!hit) throw new Error(`no official upstream release found in ${upstream}`)
  return hit.tagName
}

async function done(tag: string) {
  const title = `sync: merge upstream ${tag} into ${base}`
  const out = await $`gh pr list --repo ${repo} --state all --base ${base} --search ${title} --json title`.text()
  return (JSON.parse(out) as Array<{ title: string }>).some((x) => x.title === title)
}

async function files() {
  const out = await $`git diff --name-only --diff-filter=U`.text().catch(() => "")
  return out
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
}

async function clean() {
  await $`git merge --abort`.quiet().nothrow()
  await $`git reset --hard HEAD`.quiet().nothrow()
  await $`git clean -fd`.quiet().nothrow()
}

async function body(rel: string) {
  const log = await $`git log --oneline origin/${base}..HEAD`.text()
  const sum = log
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(0, 20)
    .map((x) => `- ${x}`)
    .join("\n")

  return [
    `Sync upstream release \`${rel}\` from \`${upstream}\`.`,
    "",
    `This PR merges \`origin/dev\` into \`${base}\` while preserving fork-specific nopecode changes.`,
    "",
    "Included commits:",
    sum || "- No commit summary available",
  ].join("\n")
}

async function main() {
  if (!repo) throw new Error("GITHUB_REPOSITORY is required")
  const rel = await latest()
  if (await done(rel)) {
    console.log(`Release ${rel} already synced or queued`)
    return
  }

  await $`git fetch origin dev --tags`
  await $`git fetch origin ${base}`
  await $`git fetch origin ${head}`.quiet().nothrow()
  await $`git checkout -B ${head} origin/${base}`

  const tags = await $`git tag --list v*`.text()
  if (await has(tags, rel)) {
    console.log(`Local repo already has tag ${rel}`)
  }

  const before = (await $`git rev-parse HEAD`.text()).trim()
  const out = await $`git merge --no-ff --no-commit origin/dev`.nothrow()
  if (out.exitCode !== 0) {
    const list = await files()
    if (!list.length) throw new Error("merge failed without conflicts")
    throw new Error(`merge conflicts: ${list.join(", ")}`)
  }

  const after = (await $`git write-tree`.text()).trim()
  const baseTree = (await $`git rev-parse origin/${base}^{tree}`.text()).trim()
  if (after === baseTree) {
    console.log("No sync changes to propose")
    await clean()
    return
  }

  await $`git add -A`
  await $`git commit -m ${`sync: merge upstream release ${rel} into ${base}`}`
  const sha = (await $`git rev-parse HEAD`.text()).trim()
  if (sha === before) {
    console.log("No commit created")
    return
  }

  await $`git push origin ${head} --force-with-lease`

  const title = `sync: merge upstream ${rel} into ${base}`
  const text = await body(rel)
  const view = await $`gh pr view ${repo.split("/")[0]}:${head} --repo ${repo} --json number`.quiet().nothrow()

  if (view.exitCode === 0) {
    await $`gh pr edit ${repo.split("/")[0]}:${head} --repo ${repo} --base ${base} --title ${title} --body ${text}`
    return
  }

  await $`gh pr create --repo ${repo} --base ${base} --head ${head} --title ${title} --body ${text}`
}

main().catch(async (err) => {
  console.error(err)
  await clean()
  process.exit(1)
})
