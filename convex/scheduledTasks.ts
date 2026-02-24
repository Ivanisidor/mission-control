import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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
    return await ctx.db.insert("scheduledTasks", {
      ...args,
      source: "cron",
      assignee: "system",
      status: "scheduled",
      createdAt: Date.now(),
    });
  },
});

export const createManual = mutation({
  args: {
    name: v.string(),
    nextRunAt: v.number(),
    assignee: v.string(),
    status: v.union(v.literal("planned"), v.literal("done"), v.literal("cancelled")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scheduledTasks", {
      name: args.name,
      scheduleKind: "manual",
      scheduleExpr: "manual",
      nextRunAt: args.nextRunAt,
      source: "manual",
      assignee: args.assignee,
      status: args.status,
      notes: args.notes,
      promotedToCron: false,
      createdAt: Date.now(),
    });
  },
});

export const updateManual = mutation({
  args: {
    id: v.id("scheduledTasks"),
    assignee: v.optional(v.string()),
    status: v.optional(v.union(v.literal("planned"), v.literal("done"), v.literal("cancelled"))),
    notes: v.optional(v.string()),
    name: v.optional(v.string()),
    nextRunAt: v.optional(v.number()),
    promotedToCron: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.source !== "manual") return null;

    const patch: Partial<Doc<"scheduledTasks">> = {};
    if (args.assignee !== undefined) patch.assignee = args.assignee;
    if (args.status !== undefined) patch.status = args.status;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.name !== undefined) patch.name = args.name;
    if (args.nextRunAt !== undefined) patch.nextRunAt = args.nextRunAt;
    if (args.promotedToCron !== undefined) patch.promotedToCron = args.promotedToCron;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

export const removeManual = mutation({
  args: { id: v.id("scheduledTasks") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.source !== "manual") return null;
    await ctx.db.delete(args.id);
    return args.id as Id<"scheduledTasks">;
  },
});
