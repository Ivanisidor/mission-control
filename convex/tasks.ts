import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const statusValidator = v.union(
  v.literal("inbox"),
  v.literal("assigned"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done"),
  v.literal("blocked"),
);

const priorityValidator = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"));

export const list = query({
  args: { status: v.optional(statusValidator), assigneeId: v.optional(v.id("agents")) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("tasks").withIndex("by_updatedAt").order("desc").collect();
    return rows.filter((r) => {
      if (args.status && r.status !== args.status) return false;
      if (args.assigneeId && !r.assigneeIds.includes(args.assigneeId)) return false;
      return true;
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    assigneeIds: v.array(v.id("agents")),
    priority: v.optional(priorityValidator),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const status = args.assigneeIds.length > 0 ? "assigned" : "inbox";
    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status,
      assigneeIds: args.assigneeIds,
      watcherIds: args.assigneeIds,
      priority: args.priority,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const assign = mutation({
  args: { id: v.id("tasks"), assigneeIds: v.array(v.id("agents")) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    const now = Date.now();
    const watcherIds = Array.from(new Set([...(task.watcherIds ?? []), ...args.assigneeIds]));
    await ctx.db.patch(args.id, {
      assigneeIds: args.assigneeIds,
      watcherIds,
      status: args.assigneeIds.length > 0 ? "assigned" : "inbox",
      updatedAt: now,
    });
    return args.id;
  },
});

export const transition = mutation({
  args: {
    id: v.id("tasks"),
    status: statusValidator,
    blockerReason: v.optional(v.string()),
    evidenceRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;

    if (args.status === "blocked" && !args.blockerReason?.trim()) {
      throw new Error("Blocked status requires blockerReason");
    }

    if (args.status === "done" && !(args.evidenceRef ?? task.evidenceRef)?.trim()) {
      throw new Error("Done status requires evidenceRef");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      blockerReason: args.blockerReason ?? task.blockerReason,
      evidenceRef: args.evidenceRef ?? task.evidenceRef,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const block = mutation({
  args: { id: v.id("tasks"), blockerReason: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "blocked", blockerReason: args.blockerReason, updatedAt: Date.now() });
    return args.id;
  },
});
