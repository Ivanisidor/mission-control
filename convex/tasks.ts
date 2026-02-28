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

export const forAgent = query({
  args: { sessionKey: v.string(), status: v.optional(statusValidator) },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_sessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!agent) return [];

    const rows = await ctx.db.query("tasks").withIndex("by_updatedAt").order("desc").collect();
    return rows.filter((r) => r.assigneeIds.includes(agent._id) && (!args.status || r.status === args.status));
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
    const id = await ctx.db.insert("tasks", {
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
    await ctx.db.insert("activityEvents", {
      type: "task_created",
      summary: `Task created: ${args.title}`,
      details: { id, status, assigneeIds: args.assigneeIds },
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
