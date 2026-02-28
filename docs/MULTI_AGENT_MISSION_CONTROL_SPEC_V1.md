# Multi-Agent Mission Control Spec (v1)

**Status:** Draft for review  
**Date:** 2026-02-28  
**Scope:** Design + implementation plan only (no code applied yet)

## 1) Objective

Turn Mission Control into a shared coordination layer for multiple OpenClaw agents, with:

- Persistent agent identities
- Shared task execution history
- Board-first collaboration (not ad-hoc side messages)
- Predictable heartbeat behavior
- Thread subscriptions and queued notifications
- Daily standup summaries
- Token/cost guardrails for orchestration

This spec preserves current local setup:

- Existing agent names and personalities
- Existing workspace and settings
- Existing Mission Control deployment shape (Next.js + Convex)

---

## 2) Non-goals (v1)

- Replacing OpenClaw session internals
- Building a new chat app
- Real-time voice workflows
- Automatic external outreach without explicit approval

---

## 3) Architecture Overview

### 3.1 Control plane

Mission Control becomes the **shared brain**:

- Task board and statuses are source of truth
- Agent actions write back to board artifacts
- Activity feed tracks all significant work events

### 3.2 Execution plane

OpenClaw sessions remain execution runtime:

- **Main sessions**: long-running, interactive
- **Isolated sessions**: one-shot wakes (cron/heartbeat/task runs)

### 3.3 Communication model

Primary: board comments + task state + notifications  
Secondary: direct session messaging (only when needed)

---

## 4) Data Model (Convex)

> Notes: Use existing tables where possible; add/extend minimally.

### 4.1 `agents`

Fields:

- `name: string`
- `role: string`
- `status: "idle" | "active" | "blocked"`
- `sessionKey: string` (e.g. `agent:nova:main`)
- `currentTaskId?: Id<"tasks">`
- `level: "intern" | "specialist" | "lead"`
- `voiceContract?: { ... }` (style constraints/checklist)
- `tokenProfile?: "light" | "normal" | "heavy"`
- `enabled: boolean`

Indexes:

- by `sessionKey`
- by `status`
- by `enabled`

### 4.2 `tasks`

Fields:

- `title: string`
- `description: string`
- `status: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked"`
- `assigneeIds: Id<"agents">[]`
- `watcherIds?: Id<"agents">[]` (optional cache; source can be subscriptions table)
- `blockerReason?: string`
- `priority?: "low" | "medium" | "high" | "urgent"`
- `evidenceRef?: string`
- `createdBy?: string`
- timestamps

Indexes:

- by `status`
- by assignee
- by updatedAt

### 4.3 `messages`

Fields:

- `taskId: Id<"tasks">`
- `fromAgentId?: Id<"agents">` (nullable for human/system)
- `content: string`
- `attachments?: Id<"documents">[]`
- `mentions?: Id<"agents">[]`
- timestamps

Indexes:

- by `taskId`
- by `createdAt`

### 4.4 `activities`

Fields:

- `type: string` (`task_created`, `task_status_changed`, `message_sent`, `document_created`, `run_started`, `run_finished`, etc.)
- `agentId?: Id<"agents">`
- `taskId?: Id<"tasks">`
- `message: string`
- `metadata?: any`
- timestamps

Indexes:

- by `taskId`
- by `createdAt`
- by `type`

### 4.5 `documents`

Fields:

- `title: string`
- `content: string` (Markdown)
- `type: "deliverable" | "research" | "protocol" | "note" | "summary"`
- `taskId?: Id<"tasks">`
- `authorAgentId?: Id<"agents">`
- timestamps

Indexes:

- by `taskId`
- by `type`

### 4.6 `notifications`

Fields:

- `mentionedAgentId: Id<"agents">`
- `taskId?: Id<"tasks">`
- `content: string`
- `delivered: boolean`
- `deliveredAt?: number`
- `deliveryAttempts: number`
- `lastError?: string`
- `nextAttemptAt?: number`
- timestamps

Indexes:

- by `delivered`
- by `mentionedAgentId`
- by `nextAttemptAt`

### 4.7 `threadSubscriptions` (new)

Fields:

- `taskId: Id<"tasks">`
- `agentId: Id<"agents">`
- `reason: "commented" | "mentioned" | "assigned" | "manual"`
- `active: boolean`
- timestamps

Unique key:

- (`taskId`, `agentId`)

### 4.8 `runs` (new)

Fields:

- `taskId?: Id<"tasks">`
- `agentId: Id<"agents">`
- `sessionKey: string`
- `sessionType: "main" | "isolated"`
- `trigger: "cron" | "heartbeat" | "manual" | "delegation"`
- `status: "started" | "ok" | "error" | "timeout" | "cancelled"`
- `model?: string`
- `provider?: string`
- `tokensIn?: number`
- `tokensOut?: number`
- `tokensTotal?: number`
- `durationMs?: number`
- `error?: string`
- `summary?: string`
- timestamps

Indexes:

- by `agentId`
- by `taskId`
- by `createdAt`

---

## 5) Lifecycle and State Machines

### 5.1 Task lifecycle

`inbox -> assigned -> in_progress -> review -> done`

Side state: `blocked`

Rules:

- `blocked` requires `blockerReason`
- `done` requires evidence (`document`, `evidenceRef`, or completion artifact)
- moving to `review` requires at least one completion message or doc

### 5.2 Subscription lifecycle

Auto-subscribe on:

- task assignment
- posting a message
- @mention

Optional unsubscribe action available.

### 5.3 Notification lifecycle

`queued -> attempted -> delivered`

On failed delivery:

- increment attempts
- store `lastError`
- compute `nextAttemptAt` with backoff
- remain queued

---

## 6) Heartbeat and Cron Behavior

### 6.1 Heartbeat contract

Each heartbeat run must:

1. Load working context (WORKING/day context where applicable)
2. Check assigned tasks and mentions
3. Check relevant activity feed delta
4. Act if needed, else return `HEARTBEAT_OK`

No speculative work outside checklist.

### 6.2 Scheduling strategy

- Stagger by agent (minute offsets)
- Isolated session mode for heartbeat runs
- Quiet exit when no board delta since last check

### 6.3 Cost controls

- Max concurrent heartbeat/task runs
- Retry limits
- No-progress detection (abort looping/redundant runs)

---

## 7) Notification Delivery Worker

### 7.1 Purpose

Deliver queued task/thread notifications to target agent sessions.

### 7.2 Worker loop

Pseudo-flow:

1. Query `notifications` where `delivered=false` and `nextAttemptAt<=now`
2. Resolve target `sessionKey` from `agents`
3. Attempt `sessions.send(sessionKey, content)`
4. On success: mark delivered + timestamp
5. On failure: increment attempts, set backoff, keep queued

### 7.3 Backoff policy

- Attempt 1-3: short retry (e.g. 10s, 30s, 60s)
- Attempt 4+: exponential capped (e.g. up to 15m)
- Poison threshold (e.g. 20 attempts) => keep queued, flag in activity feed

### 7.4 Delivery semantics

At-least-once delivery acceptable in v1.  
Idempotency key can be added in v1.1 if duplicates observed.

---

## 8) Daily Standup Pipeline

### 8.1 Schedule

One cron run daily (timezone configurable).

### 8.2 Inputs

- Tasks updated in last 24h
- Runs completed in last 24h
- Blocked tasks
- Items moved to review
- Key decision messages/docs

### 8.3 Output format

Structured summary sections:

- Completed today
- In progress
- Blocked
- Needs review
- Key decisions

### 8.4 Delivery

Delivered to configured Telegram target via existing channel pipeline.

---

## 9) Voice / SOUL / Operating Protocol Integration

### 9.1 Agent voice contracts

Each agent profile can define style constraints used for output checks.

### 9.2 Operating protocol

AGENTS.md-style constraints enforced by orchestrator policy:

- startup doc checks
- memory write expectations
- speak vs silent behavior in periodic checks

### 9.3 Memory persistence rule

Any “remember this” instruction must persist to file-backed memory path or durable board artifact.

---

## 10) APIs / Actions to Implement

### 10.1 Convex mutations/queries (high-level)

- `agents.upsert`, `agents.list`, `agents.bySessionKey`
- `tasks.transition`, `tasks.assign`, `tasks.block`, `tasks.forAgent`
- `messages.create` (with mention extraction + subscription side effects)
- `threadSubscriptions.ensure`, `threadSubscriptions.listForTask`
- `notifications.enqueueForMentions`, `notifications.enqueueForSubscribers`, `notifications.pendingBatch`, `notifications.markDelivered`, `notifications.markFailed`
- `runs.createStarted`, `runs.finish`
- `standup.buildDaily`
- `office.interactionsGraph` (aggregated nodes/edges for selected time range and optional task)

### 10.2 Optional API route/service layer

If needed for worker:

- `/api/notifications/deliver` (or script entrypoint)

---

## 11) UI Changes

### 11.1 Task board

- show assignees + status + blockers
- quick transitions with validation
- visible watcher/subscriber count

### 11.2 Task detail

- unified timeline: messages + docs + run events
- mentions autocomplete
- subscribe/unsubscribe controls

### 11.3 Team view

- session key, status, level, current task
- last run status + recent token use

### 11.4 Activity view

- stream by recency
- filter by type/agent/task

### 11.5 Standup view

- preview generated summary before send (optional in v1)

### 11.6 Interactive Office view (agent interaction map)

Goal:

- Add an office-style live view that visualizes when and how agents interact.

Display elements:

- Agent nodes (status-aware: idle, active, blocked)
- Directed interaction edges (who interacted with whom)
- Edge labels by interaction type (`@mention`, thread reply, delegated task, notification delivery)
- Time window filter (e.g. last 15m, 1h, 24h)
- Task filter (show interactions for one task only)
- Click-through to underlying task/message/run records

Interaction sources (v1):

- Mentions in task messages
- Shared task-thread participation events
- Explicit delegation events (`runs.trigger="delegation"`)
- Notification deliveries targeting agent sessions

Behavior:

- Real-time updates (subscribe to activity/message/notification changes)
- If no interactions exist in selected window, show agents only (no edges)
- Preserve board-first context: graph is a lens, not a separate communication channel

Success criteria:

- You can identify active collaboration clusters at a glance
- You can open any edge and inspect exact evidence (message/task/run)
- View remains readable with current squad size (no visual clutter)

---

## 12) Security and Safety

- No external outreach from autonomous workflows unless explicitly approved
- Notifications contain task-scoped content only (no broad memory dumps)
- Respect existing channel policies (Telegram primary)
- Keep sensitive data out of public/group deliveries

---

## 13) Performance / Cost Guardrails

- Concurrency cap for isolated runs
- Token budget profile per agent
- Abort repetitive no-progress loops
- Batch periodic checks to reduce chatter
- Track run-level token and duration metrics

Success metric:

- lower tokens per completed task vs current baseline

---

## 14) Rollout Plan

### Phase 0: Prep

- Confirm schema diff
- Backup/export current Convex data

### Phase 1: Data layer

- Add tables/fields/indexes
- Add core mutations/queries

### Phase 2: Orchestration writes

- Ensure runs/tasks/messages/documents write-back consistency

### Phase 3: Notifications + subscriptions

- Implement enqueue + worker delivery + thread subscriptions

### Phase 4: Heartbeat/cron alignment

- Staggered isolated checks + quiet exits

### Phase 5: Standup

- Generate and deliver daily summary

### Phase 6: UI polish and observability

- Board/detail/team/activity enhancements

---

## 15) Rollback Plan

- Feature flags for:
  - notification worker
  - auto-subscriptions
  - standup sender
  - heartbeat orchestration writes
- Safe disable path returns system to existing task board behavior
- Preserve all created records (no destructive rollback)

---

## 16) Acceptance Criteria

1. Every meaningful agent run is traceable in Mission Control (`runs` + activity)
2. Task collaboration history is complete in one thread
3. Notification queue reliably drains when sessions are available
4. Thread subscriptions eliminate repeated @mention spam
5. Daily standup reflects actual board activity and blockers
6. Token burn per completed task improves after guardrails

---

## 17) Open Questions for Review

1. Should `blocked` be a status or side-flag? (spec uses status)
2. Required evidence to mark `done`: minimum one document, or allow message-only with evidenceRef?
3. Notification worker runtime: pm2 process vs cron-triggered batch?
4. Standup destination(s): single DM vs group + DM mirror?
5. Agent level policy strictness in v1: enforce hard gates or soft warnings?

---

## 18) Proposed Next Step (after approval)

Create an implementation checklist that maps this spec to exact files/functions in current repo, then apply incrementally with migration-safe commits.