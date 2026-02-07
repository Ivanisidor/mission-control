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
  })
    .index("by_nextRunAt", ["nextRunAt"])
    .searchIndex("search_name", { searchField: "name" }),
});
