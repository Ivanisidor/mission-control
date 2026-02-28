import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const levelValidator = v.union(v.literal("intern"), v.literal("specialist"), v.literal("lead"));
const statusValidator = v.union(v.literal("idle"), v.literal("active"), v.literal("blocked"));
const tokenProfileValidator = v.union(v.literal("light"), v.literal("normal"), v.literal("heavy"));

export const list = query({
  args: { enabledOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("agents").collect();
    const filtered = args.enabledOnly ? rows.filter((r) => r.enabled) : rows;
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const bySessionKey = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    return (
      (await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
        .first()) ?? null
    );
  },
});

export const byId = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.id)) ?? null;
  },
});

export const seedFromTeamMembers = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const team = await ctx.db.query("teamMembers").collect();
    let inserted = 0;
    let updated = 0;

    for (const member of team) {
      const sessionKey = `agent:${member.id}`;
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_sessionKey", (q) => q.eq("sessionKey", sessionKey))
        .first();

      const role = member.role || member.roleBrief || "Agent";
      const mappedStatus = member.status === "active" ? "active" : "idle";
      const level = member.id === "main" ? "lead" : "specialist";

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: member.name,
          role,
          status: mappedStatus,
          level,
          enabled: true,
          updatedAt: now,
        });
        updated += 1;
      } else {
        await ctx.db.insert("agents", {
          name: member.name,
          role,
          status: mappedStatus,
          sessionKey,
          level,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        inserted += 1;
      }
    }

    return { inserted, updated, totalTeamMembers: team.length };
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("agents")),
    name: v.string(),
    role: v.string(),
    status: statusValidator,
    sessionKey: v.string(),
    currentTaskId: v.optional(v.id("tasks")),
    level: levelValidator,
    voiceContract: v.optional(v.any()),
    tokenProfile: v.optional(tokenProfileValidator),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        role: args.role,
        status: args.status,
        sessionKey: args.sessionKey,
        currentTaskId: args.currentTaskId,
        level: args.level,
        voiceContract: args.voiceContract,
        tokenProfile: args.tokenProfile,
        enabled: args.enabled,
        updatedAt: now,
      });
      return args.id;
    }

    const existing = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        status: args.status,
        currentTaskId: args.currentTaskId,
        level: args.level,
        voiceContract: args.voiceContract,
        tokenProfile: args.tokenProfile,
        enabled: args.enabled,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("agents", {
      name: args.name,
      role: args.role,
      status: args.status,
      sessionKey: args.sessionKey,
      currentTaskId: args.currentTaskId,
      level: args.level,
      voiceContract: args.voiceContract,
      tokenProfile: args.tokenProfile,
      enabled: args.enabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});
