import { query } from "./_generated/server";
import { v } from "convex/values";

export const buildDaily = query({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const since = args.sinceMs ?? Date.now() - 24 * 60 * 60_000;
    const tasks = await ctx.db.query("tasks").collect();
    const messages = await ctx.db.query("messages").collect();

    const completed = tasks.filter((t) => t.status === "done" && t.updatedAt >= since);
    const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "assigned");
    const blocked = tasks.filter((t) => t.status === "blocked");
    const review = tasks.filter((t) => t.status === "review");

    const decisions = messages
      .filter((m) => m.createdAt >= since && /(decision|decided|approved|deprioritized|prioritized)/i.test(m.content))
      .slice(-8)
      .map((m) => m.content);

    return {
      completedToday: completed,
      inProgress,
      blocked,
      needsReview: review,
      keyDecisions: decisions,
      generatedAt: Date.now(),
    };
  },
});
