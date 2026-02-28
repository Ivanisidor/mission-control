# Implementation Checklist v1 (executed)

## Phase 0: Prep
- [x] Schema diff reviewed
- [x] Backup script added: `npm run backup:convex`

## Phase 1: Data layer
- [x] Added new tables/indexes for agents/tasks/messages/documents/notifications/threadSubscriptions/runs
- [x] Added heartbeat and unified activity queries

## Phase 2: Orchestration writes
- [x] tasks/messages/documents/runs now write activity events for traceability
- [x] Added `tasks:forAgent`

## Phase 3: Notifications + subscriptions
- [x] Queue + retry/backoff mutations
- [x] Worker loop script in place (`worker:notifications`)

## Phase 4: Heartbeat/cron alignment
- [x] `heartbeat:check` query returns quiet-exit signal
- [x] `scripts/heartbeat-check.mjs` returns `HEARTBEAT_OK` when no action
- [x] Session staggering template documented below

### Stagger template (minute offsets)
- main: :00
- rex: :05
- scout: :10
- hawk: :15
- nova: :20
- cris: :25

## Phase 5: Standup
- [x] `standup:buildDaily`
- [x] `standup:daily` script

## Phase 6: UI polish + observability
- [x] Office includes server graph data
- [x] Activity page uses unified activity stream (events + runs)
- [x] Team page shows session key + last run status

## Migration
- [x] `agents:seedFromTeamMembers`
- [x] `tasks:migrateFromLegacyBoard`
- [x] script: `npm run migrate:v1`
