import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {
    sessionKey: v.string(),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const since = args.sinceMs ?? now - 60 * 60_000;

    const taskRows = await ctx.db.query("tasks").withIndex("by_updatedAt").order("desc").collect();
    const activityRows = await ctx.db.query("activityEvents").withIndex("by_createdAt").order("desc").collect();

    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    const assigned = agent
      ? taskRows.filter((t) => t.updatedAt >= since && t.assigneeIds.includes(agent._id) && t.status !== "done")
      : [];

    const mentions = agent
      ? activityRows.filter((a) => a.createdAt >= since && String(a.summary ?? "").toLowerCase().includes(`@${agent.name.toLowerCase().split(" ")[0]}`))
      : [];

    const boardDelta = taskRows.some((t) => t.updatedAt >= since);
    const shouldAct = assigned.length > 0 || mentions.length > 0 || boardDelta;

    return {
      shouldAct,
      quietExit: !shouldAct,
      since,
      now,
      assignedCount: assigned.length,
      mentionCount: mentions.length,
      boardDelta,
      assigned: assigned.slice(0, 20),
    };
  },
});
