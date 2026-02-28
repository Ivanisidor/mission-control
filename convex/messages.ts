import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function extractMentions(text: string) {
  return [...text.matchAll(/@([a-z0-9_-]+)/gi)].map((m) => m[1].toLowerCase());
}

export const listForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    fromAgentId: v.optional(v.id("agents")),
    content: v.string(),
    attachments: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const mentionedHandles = extractMentions(args.content);
    const allAgents = await ctx.db.query("agents").collect();
    const mentionIdSet = new Set(
      allAgents
        .filter((a) => {
          const sessionTail = a.sessionKey.split(":")[1]?.toLowerCase();
          const simpleName = a.name.toLowerCase().split(" ")[0];
          return mentionedHandles.includes(simpleName) || (sessionTail ? mentionedHandles.includes(sessionTail) : false);
        })
        .map((a) => a._id),
    );

    const id = await ctx.db.insert("messages", {
      taskId: args.taskId,
      fromAgentId: args.fromAgentId,
      content: args.content,
      attachments: args.attachments,
      mentions: [...mentionIdSet],
      createdAt: now,
      updatedAt: now,
    });

    if (args.fromAgentId) {
      const existing = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
        .collect();
      const found = existing.find((x) => x.agentId === args.fromAgentId);
      if (found) {
        await ctx.db.patch(found._id, { active: true, reason: "commented", updatedAt: now });
      } else {
        await ctx.db.insert("threadSubscriptions", {
          taskId: args.taskId,
          agentId: args.fromAgentId,
          reason: "commented",
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    for (const agentId of mentionIdSet) {
      const existing = await ctx.db
        .query("threadSubscriptions")
        .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
        .collect();
      const found = existing.find((x) => x.agentId === agentId);

      if (found) {
        await ctx.db.patch(found._id, { active: true, reason: "mentioned", updatedAt: now });
      } else {
        await ctx.db.insert("threadSubscriptions", {
          taskId: args.taskId,
          agentId,
          reason: "mentioned",
          active: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      await ctx.db.insert("notifications", {
        mentionedAgentId: agentId,
        taskId: args.taskId,
        content: args.content,
        delivered: false,
        deliveryAttempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return id;
  },
});
