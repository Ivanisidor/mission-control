import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activityEvents: defineTable({
    type: v.string(),
    summary: v.string(),
    details: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_summary", { searchField: "summary" }),

  scheduledTasks: defineTable({
    name: v.string(),
    scheduleKind: v.string(),
    scheduleExpr: v.string(),
    nextRunAt: v.number(),
    createdAt: v.number(),
    assignee: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("planned"),
        v.literal("done"),
        v.literal("cancelled"),
      ),
    ),
    source: v.optional(v.union(v.literal("cron"), v.literal("manual"))),
    notes: v.optional(v.string()),
    promotedToCron: v.optional(v.boolean()),
  })
    .index("by_nextRunAt", ["nextRunAt"])
    .searchIndex("search_name", { searchField: "name" }),

  taskBoardTasks: defineTable({
    title: v.string(),
    project: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done")),
    assignee: v.string(),
    acceptanceCriteria: v.optional(v.array(v.string())),
    artifactType: v.optional(
      v.union(
        v.literal("code"),
        v.literal("document"),
        v.literal("decision"),
        v.literal("asset"),
        v.literal("config"),
        v.literal("delivery"),
        v.literal("other"),
      ),
    ),
    evidenceRef: v.optional(v.string()),
    verificationNote: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    blockerOwner: v.optional(v.string()),
    blockerReason: v.optional(v.string()),
    unblockAction: v.optional(v.string()),
    deadlineAt: v.optional(v.number()),
    decisionRequired: v.optional(v.boolean()),
    lastStatusChangeAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_title", { searchField: "title" }),

  followUpQueue: defineTable({
    project: v.string(),
    title: v.string(),
    description: v.string(),
    actionOwner: v.string(),
    requestedBy: v.string(),
    deadline: v.optional(v.number()),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("deferred")),
    ivanNote: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_project", ["project"])
    .index("by_updatedAt", ["updatedAt"]),

  teamMembers: defineTable({
    id: v.string(),
    name: v.string(),
    type: v.union(v.literal("core"), v.literal("subagent")),
    discipline: v.union(v.literal("developers"), v.literal("writers"), v.literal("designers")),
    role: v.string(),
    roleBrief: v.string(),
    responsibilities: v.array(v.string()),
    whenToUse: v.array(v.string()),
    status: v.union(v.literal("ready"), v.literal("active"), v.literal("idle")),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_memberId", ["id"])
    .index("by_order", ["order"]),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    sessionKey: v.string(),
    currentTaskId: v.optional(v.id("tasks")),
    level: v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead")),
    voiceContract: v.optional(v.any()),
    tokenProfile: v.optional(v.union(v.literal("light"), v.literal("normal"), v.literal("heavy"))),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sessionKey", ["sessionKey"])
    .index("by_status", ["status"])
    .index("by_enabled", ["enabled"]),

  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked"),
    ),
    assigneeIds: v.array(v.id("agents")),
    watcherIds: v.optional(v.array(v.id("agents"))),
    blockerReason: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    evidenceRef: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    migrationKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_migrationKey", ["migrationKey"]),

  messages: defineTable({
    taskId: v.id("tasks"),
    fromAgentId: v.optional(v.id("agents")),
    content: v.string(),
    attachments: v.optional(v.array(v.id("documents"))),
    mentions: v.optional(v.array(v.id("agents"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_createdAt", ["createdAt"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    type: v.union(v.literal("deliverable"), v.literal("research"), v.literal("protocol"), v.literal("note"), v.literal("summary")),
    taskId: v.optional(v.id("tasks")),
    authorAgentId: v.optional(v.id("agents")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_type", ["type"]),

  notifications: defineTable({
    mentionedAgentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
    delivered: v.boolean(),
    deliveredAt: v.optional(v.number()),
    deliveryAttempts: v.number(),
    lastError: v.optional(v.string()),
    nextAttemptAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_delivered", ["delivered"])
    .index("by_mentionedAgentId", ["mentionedAgentId"])
    .index("by_nextAttemptAt", ["nextAttemptAt"]),

  threadSubscriptions: defineTable({
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    reason: v.union(v.literal("commented"), v.literal("mentioned"), v.literal("assigned"), v.literal("manual")),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taskId", ["taskId"])
    .index("by_agentId", ["agentId"]),

  runs: defineTable({
    taskId: v.optional(v.id("tasks")),
    agentId: v.id("agents"),
    sessionKey: v.string(),
    sessionType: v.union(v.literal("main"), v.literal("isolated")),
    trigger: v.union(v.literal("cron"), v.literal("heartbeat"), v.literal("manual"), v.literal("delegation")),
    status: v.union(v.literal("started"), v.literal("ok"), v.literal("error"), v.literal("timeout"), v.literal("cancelled")),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    tokensTotal: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    summary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_taskId", ["taskId"])
    .index("by_createdAt", ["createdAt"]),
});
