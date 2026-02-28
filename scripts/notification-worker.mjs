#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
const POLL_MS = Number(process.env.NOTIFICATION_POLL_MS || 2000);

if (!CONVEX_URL) {
  console.error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

async function convex(path, args = {}, kind = "query") {
  const resp = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });

  if (!resp.ok) throw new Error(`Convex ${kind} failed (${resp.status})`);
  return await resp.json();
}

async function deliver(sessionKey, content) {
  await execFileAsync("openclaw", ["sessions", "send", "--session", sessionKey, "--message", content], { timeout: 30_000 });
}

async function tick() {
  const batch = await convex("notifications:pendingBatch", { limit: 25 }, "query");
  const rows = batch?.value ?? batch ?? [];

  for (const n of rows) {
    try {
      const agentRes = await convex("agents:byId", { id: n.mentionedAgentId }, "query");
      const agent = agentRes?.value ?? agentRes;
      if (!agent?.sessionKey) throw new Error("Agent not found/sessionKey missing");

      await deliver(agent.sessionKey, n.content);
      await convex("notifications:markDelivered", { id: n._id }, "mutation");
      process.stdout.write(`delivered ${n._id} -> ${agent.sessionKey}\n`);
    } catch (err) {
      await convex("notifications:markFailed", { id: n._id, error: String(err.message ?? err) }, "mutation");
      process.stderr.write(`failed ${n._id}: ${String(err.message ?? err)}\n`);
    }
  }
}

async function loop() {
  while (true) {
    try {
      await tick();
    } catch (err) {
      process.stderr.write(`tick error: ${String(err.message ?? err)}\n`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop();
