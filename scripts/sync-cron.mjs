#!/usr/bin/env node
/**
 * Sync OpenClaw cron jobs → Convex scheduledTasks table.
 * Usage: node scripts/sync-cron.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "https://woozy-chihuahua-554.convex.cloud";

async function main() {
  // Get cron jobs as JSON-ish table from CLI
  const { stdout } = await execFileAsync("openclaw", ["cron", "list", "--all", "--timeout", "30000"], {
    timeout: 40_000,
  });

  // Parse the table output (columns: ID, Name, Schedule, Next, Last, Status, Target, Agent)
  const lines = stdout.trim().split("\n").filter(Boolean);
  if (lines.length < 2) {
    console.log("No cron jobs found.");
    return;
  }

  // Skip header
  const rows = lines.slice(1);

  for (const row of rows) {
    const cols = row.split(/\s{2,}/);
    if (cols.length < 6) continue;

    const id = cols[0]?.trim();
    const name = cols[1]?.trim() || id;
    const schedule = cols[2]?.trim() || "";

    // Parse schedule kind + expr
    let scheduleKind = "unknown";
    let scheduleExpr = schedule;
    if (schedule.startsWith("cron ")) {
      scheduleKind = "cron";
      scheduleExpr = schedule.replace(/^cron\s+/, "");
    } else if (schedule.startsWith("every ")) {
      scheduleKind = "every";
    } else if (schedule.startsWith("at ")) {
      scheduleKind = "at";
    }

    // nextRunAt: try to parse "in Xh" or similar — just use now + rough estimate
    // For a proper sync we'd use the JSON API, but this is a first pass
    const nextRunAt = Date.now() + 3600_000; // placeholder

    try {
      const resp = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "scheduledTasks:upsert",
          args: { name: `${name}`, scheduleKind, scheduleExpr, nextRunAt },
        }),
      });
      const result = await resp.json();
      console.log(`Synced: ${name} →`, result);
    } catch (err) {
      console.error(`Failed to sync ${name}:`, err.message);
    }
  }
}

main().catch((err) => {
  console.error("sync-cron failed:", err);
  process.exit(1);
});
