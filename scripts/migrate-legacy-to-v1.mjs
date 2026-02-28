#!/usr/bin/env node

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

async function convex(path, args = {}, kind = "mutation") {
  const resp = await fetch(`${CONVEX_URL}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  if (!resp.ok) throw new Error(`Convex ${kind} failed (${resp.status}) for ${path}`);
  return await resp.json();
}

const dryRun = process.argv.includes("--dry-run");

const seeded = await convex("agents:seedFromTeamMembers", {}, "mutation");
const migrated = await convex("tasks:migrateFromLegacyBoard", { dryRun }, "mutation");

console.log(JSON.stringify({ seeded: seeded.value ?? seeded, migrated: migrated.value ?? migrated, dryRun }, null, 2));
