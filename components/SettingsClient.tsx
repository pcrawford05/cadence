"use client";
import { useEffect, useState } from "react";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushControls({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "needs-install" | "off" | "on" | "denied">("unknown");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios && !standalone ? "needs-install" : "unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off"));
  }, []);

  async function enable() {
    setMsg("");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidKey) });
    const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
    setState(r.ok ? "on" : "off");
  }

  async function test() {
    const r = await fetch("/api/push/test", { method: "POST" }).then((r) => r.json());
    setMsg(r.demo ? `Demo: would send "${r.msg.title}: ${r.msg.body}"` : r.sent ? "Sent. Check your phone." : "No devices registered yet.");
  }

  return (
    <div className="space-y-2 text-sm">
      {state === "needs-install" && <p>On iPhone: tap <b>Share</b>, then <b>Add to Home Screen</b>, open Cadence from the Home Screen, and come back here.</p>}
      {state === "unsupported" && <p className="text-muted">This browser does not support push notifications.</p>}
      {state === "denied" && <p className="text-red-600">Notifications are blocked. Allow them for Cadence in your device settings.</p>}
      <div className="flex flex-wrap gap-2">
        {state === "off" && <button onClick={enable} className="btn-primary">Turn on notifications</button>}
        {state === "on" && <span className="chip border-accent text-accent">Notifications on for this device</span>}
        <button onClick={test} className="btn-ghost">Send a test</button>
      </div>
      {msg && <p className="text-muted">{msg}</p>}
    </div>
  );
}

export function SyncNow() {
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-ghost"
        onClick={async () => {
          setMsg("Syncing...");
          const r = await fetch("/api/google/sync", { method: "POST" }).then((r) => r.json());
          setMsg(r.error ? (r.reconnect ? "Google access expired. Reconnect below." : r.error) : `Logged ${r.emails} emails and ${r.meetings} meetings; ${r.suggestions} new people suggested.`);
        }}
      >
        Sync now
      </button>
      <span className="text-sm text-muted">{msg}</span>
    </div>
  );
}

export function McpToken({ appUrl, hasToken }: { appUrl: string; hasToken: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const config = token
    ? JSON.stringify({ mcpServers: { cadence: { type: "http", url: `${appUrl}/api/mcp`, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    : null;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">Lets your local agents (Claude Code, Claude Desktop) read who is due and log conversations. The token only sees your contacts.</p>
      <button
        className="btn-ghost"
        onClick={async () => {
          if (hasToken && !confirm("This replaces your existing token. Agents using the old one will stop working.")) return;
          setToken((await fetch("/api/mcp-token", { method: "POST" }).then((r) => r.json())).token);
        }}
      >
        {hasToken ? "Rotate agent token" : "Create agent token"}
      </button>
      {config && (
        <div>
          <p className="mb-1 font-medium">Copy this now; it will not be shown again.</p>
          <pre className="overflow-x-auto rounded-xl bg-paper p-3 text-xs">{config}</pre>
          <p className="mt-1 text-muted">Claude Code: <code>claude mcp add --transport http cadence {appUrl}/api/mcp --header &quot;Authorization: Bearer {token}&quot;</code></p>
        </div>
      )}
    </div>
  );
}
