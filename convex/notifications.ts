import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function nextBackoff(attempt: number) {
  if (attempt <= 1) return 10_000;
  if (attempt === 2) return 30_000;
  if (attempt === 3) return 60_000;
  return Math.min(15 * 60_000, 2 ** Math.min(attempt, 10) * 1000);
}

export const enqueue = mutation({
  args: {
    mentionedAgentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("notifications", {
      mentionedAgentId: args.mentionedAgentId,
      taskId: args.taskId,
      content: args.content,
      delivered: false,
      deliveryAttempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const pendingBatch = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_delivered", (q) => q.eq("delivered", false))
      .collect();

    return rows
      .filter((r) => (r.nextAttemptAt ?? 0) <= now)
      .sort((a, b) => (a.nextAttemptAt ?? 0) - (b.nextAttemptAt ?? 0))
      .slice(0, args.limit ?? 25);
  },
});

export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      delivered: true,
      deliveredAt: Date.now(),
      updatedAt: Date.now(),
      lastError: undefined,
    });
    return args.id;
  },
});

export const markFailed = mutation({
  args: { id: v.id("notifications"), error: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const attempts = (row.deliveryAttempts ?? 0) + 1;
    await ctx.db.patch(args.id, {
      deliveryAttempts: attempts,
      lastError: args.error,
      nextAttemptAt: Date.now() + nextBackoff(attempts),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const enqueueForSubscribers = mutation({
  args: { taskId: v.id("tasks"), content: v.string(), excludeAgentId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const subs = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    const active = subs.filter((s) => s.active && s.agentId !== args.excludeAgentId);
    const ids = [];
    for (const s of active) {
      ids.push(
        await ctx.db.insert("notifications", {
          mentionedAgentId: s.agentId,
          taskId: args.taskId,
          content: args.content,
          delivered: false,
          deliveryAttempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    return ids;
  },
});
