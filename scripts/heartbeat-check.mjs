#!/usr/bin/env node

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

const sessionKey = process.env.HEARTBEAT_SESSION_KEY || "agent:main";
const sinceMs = Number(process.env.HEARTBEAT_SINCE_MS || (Date.now() - 60 * 60_000));

const resp = await fetch(`${CONVEX_URL}/api/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "heartbeat:check", args: { sessionKey, sinceMs } }),
});

if (!resp.ok) {
  console.error(`heartbeat check failed (${resp.status})`);
  process.exit(1);
}

const data = await resp.json();
const out = data.value ?? data;
if (out.quietExit) {
  console.log("HEARTBEAT_OK");
} else {
  console.log(JSON.stringify(out, null, 2));
}
