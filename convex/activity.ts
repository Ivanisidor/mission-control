import { query } from "./_generated/server";
import { v } from "convex/values";

export const unifiedRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const base = await ctx.db.query("activityEvents").withIndex("by_createdAt").order("desc").collect();
    const runs = await ctx.db.query("runs").withIndex("by_createdAt").order("desc").collect();

    const runEvents = runs.slice(0, limit).map((r) => ({
      _id: `run:${String(r._id)}`,
      type: `run_${r.status}`,
      summary: r.summary ?? `Run ${r.status} (${r.trigger})`,
      createdAt: r.updatedAt ?? r.createdAt,
      details: { agentId: r.agentId, taskId: r.taskId, trigger: r.trigger, tokensTotal: r.tokensTotal, durationMs: r.durationMs },
    }));

    const merged = [...base, ...runEvents]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return merged;
  },
});
