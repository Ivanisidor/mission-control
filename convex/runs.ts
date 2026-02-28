import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const sessionTypeValidator = v.union(v.literal("main"), v.literal("isolated"));
const triggerValidator = v.union(v.literal("cron"), v.literal("heartbeat"), v.literal("manual"), v.literal("delegation"));
const runStatusValidator = v.union(v.literal("started"), v.literal("ok"), v.literal("error"), v.literal("timeout"), v.literal("cancelled"));

export const list = query({
  args: { taskId: v.optional(v.id("tasks")), agentId: v.optional(v.id("agents")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("runs").withIndex("by_createdAt").order("desc").collect();
    return rows
      .filter((r) => (args.taskId ? r.taskId === args.taskId : true) && (args.agentId ? r.agentId === args.agentId : true))
      .slice(0, args.limit ?? 100);
  },
});

export const createStarted = mutation({
  args: {
    taskId: v.optional(v.id("tasks")),
    agentId: v.id("agents"),
    sessionKey: v.string(),
    sessionType: sessionTypeValidator,
    trigger: triggerValidator,
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("runs", {
      taskId: args.taskId,
      agentId: args.agentId,
      sessionKey: args.sessionKey,
      sessionType: args.sessionType,
      trigger: args.trigger,
      status: "started",
      model: args.model,
      provider: args.provider,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const finish = mutation({
  args: {
    id: v.id("runs"),
    status: runStatusValidator,
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    tokensTotal: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      tokensIn: args.tokensIn,
      tokensOut: args.tokensOut,
      tokensTotal: args.tokensTotal,
      durationMs: args.durationMs,
      error: args.error,
      summary: args.summary,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
