// Live test harness — spawns a real opencode server subprocess and waits
// until it is ready to accept HTTP requests.
//
// Usage:
//   await using srv = await startServer(dir)
//   const res = await fetch(`${srv.url}/provider`)
//
// The server is killed automatically when the `await using` block exits.
//
// Set OPENCODE_FORK_LIVE_TESTS=1 to enable live tests.
// Set OPENCODE_BIN_PATH to override the binary path (defaults to the dev entry point).

import os from "os"
import path from "path"
import fs from "fs/promises"
import { setTimeout as sleep } from "node:timers/promises"

export const LIVE = process.env["OPENCODE_FORK_LIVE_TESTS"] === "1"

type Server = {
  url: string
  dir: string
  proc: ReturnType<typeof Bun.spawn>
  stop: () => Promise<void>
  [Symbol.asyncDispose]: () => Promise<void>
}

// Poll a URL until it responds with any non-error status, or timeout.
async function poll(url: string, ms = 15_000): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const ok = await fetch(url)
      .then((r) => r.status < 500)
      .catch(() => false)
    if (ok) return
    await sleep(150)
  }
  throw new Error(`Server at ${url} did not become ready within ${ms}ms`)
}

export async function startServer(dir?: string): Promise<Server> {
  const tmp = dir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "opencode-live-test-")))

  // Write a minimal config so the server starts cleanly
  await fs.writeFile(path.join(tmp, "opencode.json"), JSON.stringify({ $schema: "https://opencode.ai/config.json" }))

  // Inherit the real user's XDG dirs so Kiro auth tokens are visible
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    // Use a real on-disk DB (not :memory:) so auth state persists across the subprocess
    OPENCODE_DB: path.join(tmp, "opencode.db"),
    // Disable auto-update so the server doesn't try to upgrade itself during tests
    OPENCODE_DISABLE_AUTOUPDATE: "1",
  }
  // Remove test-harness-only overrides that would break the live server
  delete env["OPENCODE_DISABLE_DEFAULT_PLUGINS"]
  delete env["OPENCODE_ALLOW_ALL_PROVIDERS"]
  delete env["OPENCODE_TEST_HOME"]
  delete env["OPENCODE_TEST_MANAGED_CONFIG_DIR"]
  delete env["OPENCODE_MODELS_PATH"]
  // Clear XDG overrides set by the test preload so the subprocess uses the
  // real user dirs (where Kiro auth tokens live)
  delete env["XDG_DATA_HOME"]
  delete env["XDG_CACHE_HOME"]
  delete env["XDG_CONFIG_HOME"]
  delete env["XDG_STATE_HOME"]

  // Use OPENCODE_BIN_PATH if set, otherwise find the installed binary
  const bin =
    process.env["OPENCODE_BIN_PATH"] ??
    Bun.which("opencode") ??
    path.join(process.env["HOME"] ?? "~", ".opencode", "bin", "opencode")
  const cmd = [bin, "serve", "--port", "0"]

  const proc = Bun.spawn(cmd, {
    cwd: tmp,
    env,
    stdout: "pipe",
    stderr: "pipe",
  })

  // Read stdout to find the port from the "opencode server listening on ..." line.
  // We use a simple read loop — reader.read() resolves as soon as the process
  // writes a chunk, so no sleep/race needed.
  let url = ""
  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  const readWithTimeout = (ms: number) =>
    Promise.race([
      reader.read(),
      sleep(ms).then(() => {
        throw new Error("read timeout")
      }),
    ])

  try {
    while (true) {
      const { value, done } = await readWithTimeout(15_000)
      if (done) break
      if (value) buf += decoder.decode(value)
      const match = buf.match(/opencode server listening on (http:\/\/\S+)/)
      if (match) {
        url = match[1]
        break
      }
    }
  } catch {
    // timeout or stream error — url stays empty
  }

  if (!url) {
    proc.kill()
    throw new Error("Could not determine server URL from stdout")
  }

  // Poll until the server is actually accepting requests
  await poll(url)

  const stop = async () => {
    proc.kill()
    await proc.exited.catch(() => {})
  }

  return {
    url,
    dir: tmp,
    proc,
    stop,
    [Symbol.asyncDispose]: stop,
  }
}
