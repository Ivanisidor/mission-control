import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("deferred"),
);

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("followUpQueue")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "approved" | "rejected" | "deferred"))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("followUpQueue")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    project: v.string(),
    title: v.string(),
    description: v.string(),
    actionOwner: v.string(),
    requestedBy: v.string(),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("followUpQueue", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const resolve = mutation({
  args: {
    id: v.id("followUpQueue"),
    status: statusValidator,
    ivanNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      ivanNote: args.ivanNote,
      resolvedAt: now,
      updatedAt: now,
    });
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("followUpQueue") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    await ctx.db.delete(args.id);
    return args.id;
  },
});
