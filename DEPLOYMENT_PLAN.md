# Mission Control (LAN-only) — Deployment Plan

Goal: Persistent, searchable activity log stored in Convex + Mission Control UI reachable on LAN.

## Overview
- Convex: hosted deployment (durable DB)
- Mission Control: Next.js production server bound to 0.0.0.0 (LAN)
- Ingest API protected by bearer token

## Steps
1) Convex login (interactive)
2) Create + deploy Convex project
3) Update Mission Control env to point at hosted Convex URL
4) Build + run Mission Control as a systemd service
5) Wire OpenClaw activity events -> Mission Control ingest

## Security notes
- Keep `ACTIVITY_INGEST_TOKEN` secret; rotate if leaked.
- Consider LAN firewall rules if needed.
