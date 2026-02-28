import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const docType = v.union(v.literal("deliverable"), v.literal("research"), v.literal("protocol"), v.literal("note"), v.literal("summary"));

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: docType,
    taskId: v.optional(v.id("tasks")),
    authorAgentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("documents", { ...args, createdAt: now, updatedAt: now });
    await ctx.db.insert("activityEvents", {
      type: "document_created",
      summary: `Document created: ${args.title}`,
      details: { id, taskId: args.taskId, type: args.type, authorAgentId: args.authorAgentId },
      createdAt: now,
    });
    return id;
  },
});

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});
