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
});
