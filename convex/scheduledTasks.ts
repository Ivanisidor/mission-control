import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listUpcoming = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const from = args.from ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
    const to = args.to ?? Date.now() + 14 * 24 * 60 * 60 * 1000;
    const limit = args.limit ?? 500;

    const rows = await ctx.db
      .query("scheduledTasks")
      .withIndex("by_nextRunAt", (q) => q.gte("nextRunAt", from).lte("nextRunAt", to))
      .order("asc")
      .take(limit);

    return rows;
  },
});

export const upsert = mutation({
  args: {
    name: v.string(),
    scheduleKind: v.string(),
    scheduleExpr: v.string(),
    nextRunAt: v.number(),
  },
  handler: async (ctx, args) => {
    // simple insert-only for now; callers can manage de-dupe
    return await ctx.db.insert("scheduledTasks", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
