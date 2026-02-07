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
- prompt you to login (cloud) **or** let you run locally without an account
- create a dev deployment
- generate `convex/_generated/` (required for the Next.js app)

#### Non-interactive / no-login mode (local anonymous deployment)

If you want to run Convex locally without logging in (useful for headless setups), you can do:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

This will create a local deployment at `http://127.0.0.1:3210` and write URLs to `.env.local`.

Environment variables:

Copy `.env.example` → `.env.local` and edit:

```bash
cp .env.example .env.local
```

At minimum set:
- `ACTIVITY_INGEST_TOKEN`
- (optional) `MISSION_CONTROL_BASE_URL` (defaults to `http://localhost:3000`)

## Run the app

```bash
npm run dev
```

Open: http://localhost:3000

## Activity ingestion

### Log helper script

Once the app is running locally, you can write an event into the feed:

```bash
npm run log -- tool.exec "Ran tests" '{"command":"npm test"}'
```

(Equivalent to POSTing to `/api/activity/ingest`.)


POST to:

`/api/activity/ingest`

Headers:
- `Authorization: Bearer <ACTIVITY_INGEST_TOKEN>`

Body:

```json
{ "type": "tool.exec", "summary": "Ran tests", "details": { "command": "..." } }
```
