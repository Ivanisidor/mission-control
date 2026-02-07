# Mission Control Dashboard

A Next.js + Convex dashboard for:
- Activity feed (everything Nux does)
- Weekly calendar view of scheduled tasks
- Global search across Convex + workspace markdown files

## Prereqs
- Node.js 18+
- `rg` (ripgrep) installed (used for workspace search)

## Setup

Install deps:

```bash
npm install
```

### Convex

Initialize and run Convex locally:

```bash
npx convex dev
```

This will:
- prompt you to login
- create a dev deployment
- generate `convex/_generated/` (required for the Next.js app)

Environment variables:

Create `.env.local`:

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL="<your convex dev deployment url>"
CONVEX_URL="<same as above>"

# Activity ingest route
ACTIVITY_INGEST_TOKEN="change-me"
```

## Run the app

```bash
npm run dev
```

Open: http://localhost:3000

## Activity ingestion

POST to:

`/api/activity/ingest`

Headers:
- `Authorization: Bearer <ACTIVITY_INGEST_TOKEN>`

Body:

```json
{ "type": "tool.exec", "summary": "Ran tests", "details": { "command": "..." } }
```
