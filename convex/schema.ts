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
    assignee: v.optional(v.union(v.literal("ivan"), v.literal("nux"), v.literal("system"))),
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
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done")),
    assignee: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_title", { searchField: "title" }),
});
