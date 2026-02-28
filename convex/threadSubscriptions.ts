import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const reasonValidator = v.union(v.literal("commented"), v.literal("mentioned"), v.literal("assigned"), v.literal("manual"));

export const ensure = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    reason: reasonValidator,
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    const found = existing.find((x) => x.agentId === args.agentId) ?? null;
    const now = Date.now();
    const active = args.active ?? true;

    if (found) {
      await ctx.db.patch(found._id, { reason: args.reason, active, updatedAt: now });
      return found._id;
    }

    return await ctx.db.insert("threadSubscriptions", {
      taskId: args.taskId,
      agentId: args.agentId,
      reason: args.reason,
      active,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listForTask = query({
  args: { taskId: v.id("tasks"), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    return args.activeOnly ? rows.filter((r) => r.active) : rows;
  },
});
