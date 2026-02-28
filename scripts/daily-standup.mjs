#!/usr/bin/env node

const CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

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

function line(item, fallback = "(untitled)") {
  return `• ${item.title ?? fallback}`;
}

async function main() {
  const res = await convex("standup:buildDaily", {}, "query");
  const data = res?.value ?? res;

  const sections = [
    `📊 DAILY STANDUP — ${new Date(data.generatedAt).toLocaleDateString()}`,
    "",
    "✅ COMPLETED TODAY",
    ...(data.completedToday.length ? data.completedToday.map((t) => line(t)) : ["• None"]),
    "",
    "🔄 IN PROGRESS",
    ...(data.inProgress.length ? data.inProgress.map((t) => line(t)) : ["• None"]),
    "",
    "🚫 BLOCKED",
    ...(data.blocked.length ? data.blocked.map((t) => line(t)) : ["• None"]),
    "",
    "👀 NEEDS REVIEW",
    ...(data.needsReview.length ? data.needsReview.map((t) => line(t)) : ["• None"]),
    "",
    "📝 KEY DECISIONS",
    ...(data.keyDecisions.length ? data.keyDecisions.map((x) => `• ${x}`) : ["• None"]),
  ];

  console.log(sections.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
