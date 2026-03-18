import type { Event } from "@opencode-ai/sdk"
import type { Plugin } from "@opencode-ai/plugin"
import { Config } from "@/config/config"
import { Session } from "@/session"
import { SessionID } from "@/session/schema"

function esc(input: string) {
  return input.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

export function shouldNotify(seen: Set<string>, event: Event) {
  if (event.type === "session.status") {
    const sessionID = event.properties.sessionID
    const status = event.properties.status
    if (status.type !== "idle") {
      seen.add(sessionID)
      return false
    }
    if (!seen.has(sessionID)) return false
    seen.delete(sessionID)
    return true
  }

  if (event.type !== "session.error") return false
  const sessionID = event.properties.sessionID
  if (sessionID && !seen.has(sessionID)) return false
  if (sessionID) seen.delete(sessionID)
  return true
}

async function send(title: string, message: string, sound: boolean) {
  if (process.platform === "darwin") {
    const parts = [`display notification "${esc(message)}" with title "${esc(title)}"`]
    if (sound) parts.push(`sound name "Glass"`)
    await Bun.spawn(["osascript", "-e", parts.join(" ")], {
      stdout: "ignore",
      stderr: "ignore",
    }).exited.catch(() => undefined)
    return
  }

  if (process.platform === "linux") {
    const cmd = sound ? ["notify-send", "--urgency=normal", title, message] : ["notify-send", title, message]
    await Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).exited.catch(() => undefined)
    return
  }

  if (process.platform === "win32") {
    const script = [
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null`,
      `[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null`,
      `$xml = New-Object Windows.Data.Xml.Dom.XmlDocument`,
      `$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>${esc(title)}</text><text>${esc(message)}</text></binding></visual></toast>")`,
      `$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)`,
      `$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("opencode")`,
      `$notifier.Show($toast)`,
    ].join("; ")
    await Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], {
      stdout: "ignore",
      stderr: "ignore",
    }).exited.catch(() => undefined)
  }
}

export const NotifyPlugin: Plugin = async () => {
  const seen = new Set<string>()

  return {
    event: async ({ event }: { event: Event }) => {
      const cfg = await Config.get()
      const notify = cfg.notify ?? {}
      const enabled = notify.enabled ?? true
      if (!enabled) return

      if (event.type === "session.status") {
        if (!shouldNotify(seen, event)) return
        const sessionID = event.properties.sessionID
        const info = await Session.get(SessionID.make(sessionID)).catch(() => undefined)
        if (info?.parentID) return
        const title = info?.title && !Session.isDefaultTitle(info.title) ? info.title : "Ready for review"
        await send("opencode", title, notify.sound ?? false)
        return
      }

      if (event.type !== "session.error") return
      if (!shouldNotify(seen, event)) return
      const sessionID = event.properties.sessionID
      if (sessionID) {
        const info = await Session.get(SessionID.make(sessionID)).catch(() => undefined)
        if (info?.parentID) return
      }
      const err = event.properties.error
      const message = typeof err === "string" ? err : JSON.stringify(err)
      await send("opencode", message.slice(0, 120), notify.sound ?? false)
    },
  }
}
