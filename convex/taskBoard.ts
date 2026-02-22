import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const statusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("done"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("taskBoardTasks").withIndex("by_updatedAt").order("desc").collect();
  },
});

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("taskBoardTasks").take(1);
    if (existing.length > 0) return false;

    const now = Date.now();
    const seed: Array<{ title: string; status: "todo" | "in_progress" | "blocked" | "done"; assignee: string }> = [
      { title: "Fix WSL Docker credential helper mismatch", status: "done", assignee: "nux-core" },
      { title: "Approve gateway device pairing scope upgrade", status: "done", assignee: "nux-core" },
      { title: "Verify multi-agent smoke test after config changes", status: "done", assignee: "nux-core" },
      { title: "Move manual calendar events from local storage to Convex", status: "done", assignee: "dev-backend" },
      { title: "Review and prioritize next project tasks", status: "todo", assignee: "ivan" },
    ];

    for (const t of seed) {
      await ctx.db.insert("taskBoardTasks", { ...t, createdAt: now, updatedAt: now });
    }

    return true;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    assignee: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("taskBoardTasks", {
      title: args.title,
      assignee: args.assignee,
      status: "todo",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("taskBoardTasks"),
    title: v.optional(v.string()),
    assignee: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    const patch: { title?: string; assignee?: string; status?: "todo" | "in_progress" | "blocked" | "done"; updatedAt: number } = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.assignee !== undefined) patch.assignee = args.assignee;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});
