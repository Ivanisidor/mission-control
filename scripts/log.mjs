#!/usr/bin/env node

// Minimal activity logger for local dev.
// Usage:
//   node scripts/log.mjs tool.exec "Ran command" '{"command":"ls"}'
//
// Env:
//   MISSION_CONTROL_BASE_URL (default http://localhost:3000)
//   ACTIVITY_INGEST_TOKEN (required)

const [,, type, summary, detailsJson] = process.argv;

if (!type || !summary) {
  console.error("Usage: node scripts/log.mjs <type> <summary> [detailsJson]");
  process.exit(2);
}

const baseUrl = process.env.MISSION_CONTROL_BASE_URL || "http://localhost:3000";
const token = process.env.ACTIVITY_INGEST_TOKEN;

if (!token) {
  console.error("ACTIVITY_INGEST_TOKEN is not set.");
  process.exit(2);
}

let details;
if (detailsJson) {
  try {
    details = JSON.parse(detailsJson);
  } catch (e) {
    console.error("detailsJson must be valid JSON");
    process.exit(2);
  }
}

const url = new URL("/api/activity/ingest", baseUrl).toString();

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ type, summary, details }),
});

if (!res.ok) {
  const text = await res.text().catch(() => "");
  console.error(`Failed (${res.status}): ${text}`);
  process.exit(1);
}

const data = await res.json().catch(() => ({}));
console.log(JSON.stringify(data, null, 2));
