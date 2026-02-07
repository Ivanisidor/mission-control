import { v } from "convex/values";
import { query } from "./_generated/server";

export const searchAll = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const term = args.term.trim();
    const limit = args.limit ?? 20;
    if (!term) return { activityEvents: [], scheduledTasks: [] };

    // Use search indexes where available
    const activityEvents = await ctx.db
      .query("activityEvents")
      .withSearchIndex("search_summary", (q) => q.search("summary", term))
      .take(limit);

    const scheduledTasks = await ctx.db
      .query("scheduledTasks")
      .withSearchIndex("search_name", (q) => q.search("name", term))
      .take(limit);

    return { activityEvents, scheduledTasks };
  },
});
