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

function parseMentionHandles(text: string) {
  const matches = text.match(/@[a-z0-9_-]+/gi) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

function sessionTail(sessionKey: string) {
  return sessionKey.split(":").pop()?.toLowerCase() ?? "";
}

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

export const forAgent = query({
  args: { sessionKey: v.string(), status: v.optional(statusValidator) },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!agent) return [];

    const rows = await ctx.db.query("tasks").withIndex("by_updatedAt").order("desc").collect();
    return rows.filter((r) => {
      const visible = r.assigneeIds.includes(agent._id) || (r.watcherIds ?? []).includes(agent._id);
      if (!visible) return false;
      if (args.status && r.status !== args.status) return false;
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

    const allAgents = await ctx.db.query("agents").collect();
    const mentions = parseMentionHandles(`${args.title} ${args.description}`);
    const mentionedAgents = allAgents.filter((a) => {
      const tail = sessionTail(a.sessionKey);
      const firstName = a.name.split(" ")[0]?.toLowerCase() ?? "";
      return mentions.includes(tail) || mentions.includes(firstName);
    });

    const watcherIds = Array.from(new Set([...args.assigneeIds, ...mentionedAgents.map((a) => a._id)]));

    const id = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status,
      assigneeIds: args.assigneeIds,
      watcherIds,
      priority: args.priority,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    for (const mentioned of mentionedAgents) {
      await ctx.db.insert("threadSubscriptions", {
        taskId: id,
        agentId: mentioned._id,
        reason: "mentioned",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notifications", {
        mentionedAgentId: mentioned._id,
        taskId: id,
        content: `You were mentioned on task: ${args.title}`,
        delivered: false,
        deliveryAttempts: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("activityEvents", {
      type: "task_created",
      summary: `Task created: ${args.title}`,
      details: { id, status, assigneeIds: args.assigneeIds, mentionCount: mentionedAgents.length },
      createdAt: now,
    });
    return id;
  },
});

export const assign = mutation({
  args: { id: v.id("tasks"), assigneeIds: v.array(v.id("agents")) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return null;
    const now = Date.now();
    const watcherIds = Array.from(new Set([...(task.watcherIds ?? []), ...args.assigneeIds]));
    const status = args.assigneeIds.length > 0 ? "assigned" : "inbox";
    await ctx.db.patch(args.id, {
      assigneeIds: args.assigneeIds,
      watcherIds,
      status,
      updatedAt: now,
    });
    await ctx.db.insert("activityEvents", {
      type: "task_assigned",
      summary: `Task assigned (${args.assigneeIds.length} assignee${args.assigneeIds.length === 1 ? "" : "s"})`,
      details: { id: args.id, assigneeIds: args.assigneeIds, status },
      createdAt: now,
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

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.status,
      blockerReason: args.blockerReason ?? task.blockerReason,
      evidenceRef: args.evidenceRef ?? task.evidenceRef,
      updatedAt: now,
    });
    await ctx.db.insert("activityEvents", {
      type: "task_status_changed",
      summary: `Task moved to ${args.status}`,
      details: { id: args.id, status: args.status, blockerReason: args.blockerReason, evidenceRef: args.evidenceRef },
      createdAt: now,
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

export const claimAssignedForSessionKey = mutation({
  args: { sessionKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (!agent) return { claimed: 0, taskIds: [] as string[] };

    const cap = Math.max(1, Math.min(args.limit ?? 20, 100));
    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "assigned"))
      .collect();

    const toClaim = assigned.filter((t) => t.assigneeIds.includes(agent._id)).slice(0, cap);
    const now = Date.now();

    for (const task of toClaim) {
      await ctx.db.patch(task._id, {
        status: "in_progress",
        updatedAt: now,
      });
      await ctx.db.insert("activityEvents", {
        type: "task_claimed",
        summary: `${agent.name} claimed task: ${task.title}`,
        details: { id: task._id, claimedBy: agent._id, claimedBySessionKey: args.sessionKey },
        createdAt: now,
      });
    }

    return { claimed: toClaim.length, taskIds: toClaim.map((t) => String(t._id)) };
  },
});

export const delegatePortion = mutation({
  args: {
    taskId: v.id("tasks"),
    fromSessionKey: v.string(),
    toSessionKey: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const fromAgent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.fromSessionKey))
      .first();
    const toAgent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.toSessionKey))
      .first();

    if (!fromAgent || !toAgent) throw new Error("Invalid from/to agent session key");
    if (!task.assigneeIds.includes(fromAgent._id)) throw new Error("Only assigned agents can delegate this task");

    const now = Date.now();
    const assigneeIds = Array.from(new Set([...task.assigneeIds, toAgent._id]));
    const watcherIds = Array.from(new Set([...(task.watcherIds ?? []), toAgent._id]));

    await ctx.db.patch(args.taskId, {
      assigneeIds,
      watcherIds,
      status: task.status === "inbox" ? "assigned" : task.status,
      updatedAt: now,
    });

    const existingSub = await ctx.db
      .query("threadSubscriptions")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    const already = existingSub.find((s) => s.agentId === toAgent._id);
    if (!already) {
      await ctx.db.insert("threadSubscriptions", {
        taskId: args.taskId,
        agentId: toAgent._id,
        reason: "assigned",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const content =
      `Handoff request from ${fromAgent.name}: ${task.title}` +
      (args.note?.trim() ? `\n\nScope note: ${args.note.trim()}` : "");

    await ctx.db.insert("notifications", {
      mentionedAgentId: toAgent._id,
      taskId: args.taskId,
      content,
      delivered: false,
      deliveryAttempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activityEvents", {
      type: "task_handoff",
      summary: `${fromAgent.name} handed off part of task to ${toAgent.name}`,
      details: { taskId: args.taskId, fromAgentId: fromAgent._id, toAgentId: toAgent._id, note: args.note },
      createdAt: now,
    });

    return { taskId: args.taskId, toAgentId: toAgent._id };
  },
});

export const migrateFromLegacyBoard = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = !!args.dryRun;
    const legacyRows = await ctx.db.query("taskBoardTasks").collect();
    const agents = await ctx.db.query("agents").collect();

    const agentByTail = new Map<string, (typeof agents)[number]>();
    for (const a of agents) {
      const tail = a.sessionKey.split(":")[1]?.toLowerCase();
      if (tail) agentByTail.set(tail, a);
    }

    const mapStatus = (s: string) => {
      if (s === "todo") return "inbox" as const;
      if (s === "in_progress") return "in_progress" as const;
      if (s === "blocked") return "blocked" as const;
      if (s === "done") return "done" as const;
      return "inbox" as const;
    };

    let inserted = 0;
    let skipped = 0;

    for (const row of legacyRows) {
      const migrationKey = `taskBoard:${String(row._id)}`;
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_migrationKey", (q) => q.eq("migrationKey", migrationKey))
        .first();
      if (existing) {
        skipped += 1;
        continue;
      }

      const assigneeTail = String((row as { assignee?: string }).assignee ?? "main").toLowerCase();
      const agent = agentByTail.get(assigneeTail) ?? agentByTail.get("main");
      const assigneeIds = agent ? [agent._id] : [];
      const now = Date.now();

      if (!dryRun) {
        await ctx.db.insert("tasks", {
          title: row.title,
          description: row.title,
          status: mapStatus(String(row.status)),
          assigneeIds,
          watcherIds: assigneeIds,
          blockerReason: (row as { blockerReason?: string }).blockerReason,
          evidenceRef: (row as { evidenceRef?: string }).evidenceRef,
          createdBy: "migration",
          migrationKey,
          createdAt: (row as { createdAt?: number }).createdAt ?? now,
          updatedAt: (row as { updatedAt?: number }).updatedAt ?? now,
        });
      }
      inserted += 1;
    }

    return { totalLegacy: legacyRows.length, inserted, skipped, dryRun };
  },
});
