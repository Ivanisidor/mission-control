import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const statusValidator = v.union(v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done"));
const artifactTypeValidator = v.union(
  v.literal("code"),
  v.literal("document"),
  v.literal("decision"),
  v.literal("asset"),
  v.literal("config"),
  v.literal("delivery"),
  v.literal("other"),
);

type Status = "todo" | "in_progress" | "blocked" | "done";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("taskBoardTasks").withIndex("by_updatedAt").order("desc").collect();
  },
});

export const escalationView = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const tasks = await ctx.db.query("taskBoardTasks").collect();
    return tasks
      .filter((t) => t.status === "blocked")
      .map((t) => {
        const ageHours = Math.floor((now - (t.lastStatusChangeAt ?? t.updatedAt)) / 36e5);
        const level = ageHours >= 48 ? "ivan_now" : ageHours >= 24 ? "decision_required" : "monitor";
        return {
          id: t._id,
          title: t.title,
          assignee: t.assignee,
          blockerOwner: t.blockerOwner ?? "unassigned",
          ageHours,
          level,
          deadlineAt: t.deadlineAt ?? null,
          decisionRequired: t.decisionRequired ?? false,
        };
      })
      .sort((a, b) => b.ageHours - a.ageHours);
  },
});

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("taskBoardTasks").take(1);
    if (existing.length > 0) return false;

    const now = Date.now();
    const seed: Array<{ title: string; status: Status; assignee: string }> = [
      { title: "Review and prioritize next project tasks", status: "todo", assignee: "ivan" },
    ];

    for (const t of seed) {
      await ctx.db.insert("taskBoardTasks", {
        ...t,
        project: "default",
        createdAt: now,
        updatedAt: now,
        lastStatusChangeAt: now,
      });
    }

    return true;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    assignee: v.string(),
    project: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("taskBoardTasks", {
      title: args.title,
      assignee: args.assignee,
      project: args.project ?? "default",
      acceptanceCriteria: args.acceptanceCriteria,
      status: "todo",
      createdAt: now,
      updatedAt: now,
      lastStatusChangeAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("taskBoardTasks"),
    title: v.optional(v.string()),
    assignee: v.optional(v.string()),
    project: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    status: v.optional(statusValidator),
    artifactType: v.optional(artifactTypeValidator),
    evidenceRef: v.optional(v.string()),
    verificationNote: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    blockerOwner: v.optional(v.string()),
    blockerReason: v.optional(v.string()),
    unblockAction: v.optional(v.string()),
    deadlineAt: v.optional(v.number()),
    decisionRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;

    const nextStatus = args.status ?? existing.status;
    const acceptanceCriteria = args.acceptanceCriteria ?? existing.acceptanceCriteria ?? [];
    const evidenceRef = args.evidenceRef ?? existing.evidenceRef ?? "";
    const verificationNote = args.verificationNote ?? existing.verificationNote ?? "";
    const verifiedBy = args.verifiedBy ?? existing.verifiedBy ?? "";
    const blockerOwner = args.blockerOwner ?? existing.blockerOwner ?? "";
    const blockerReason = args.blockerReason ?? existing.blockerReason ?? "";
    const unblockAction = args.unblockAction ?? existing.unblockAction ?? "";
    const deadlineAt = args.deadlineAt ?? existing.deadlineAt;

    const statusChanging = args.status !== undefined && args.status !== existing.status;

    if (nextStatus === "done" && (statusChanging || args.status === "done")) {
      if (statusChanging) {
        if (acceptanceCriteria.length === 0) throw new Error("Cannot mark done without acceptance criteria.");
        if (!evidenceRef.trim()) throw new Error("Cannot mark done without evidence reference.");
        if (!verificationNote.trim()) throw new Error("Cannot mark done without verification note.");
        if (!verifiedBy.trim()) throw new Error("Cannot mark done without verifiedBy.");
      }
    }

    if (nextStatus === "blocked" && statusChanging) {
      if (!blockerOwner.trim() || !blockerReason.trim() || !unblockAction.trim() || !deadlineAt) {
        throw new Error("Blocked tasks require blocker owner, reason, unblock action, and deadline.");
      }
    }

    const now = Date.now();
    const patch: {
      title?: string;
      assignee?: string;
      project?: string;
      acceptanceCriteria?: string[];
      status?: Status;
      artifactType?: "code" | "document" | "decision" | "asset" | "config" | "delivery" | "other";
      evidenceRef?: string;
      verificationNote?: string;
      verifiedBy?: string;
      verifiedAt?: number;
      blockerOwner?: string;
      blockerReason?: string;
      unblockAction?: string;
      deadlineAt?: number;
      decisionRequired?: boolean;
      updatedAt: number;
      lastStatusChangeAt?: number;
    } = { updatedAt: now };

    if (args.title !== undefined) patch.title = args.title;
    if (args.assignee !== undefined) patch.assignee = args.assignee;
    if (args.project !== undefined) patch.project = args.project;
    if (args.acceptanceCriteria !== undefined) patch.acceptanceCriteria = args.acceptanceCriteria;
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status !== existing.status) patch.lastStatusChangeAt = now;
    }
    if (args.artifactType !== undefined) patch.artifactType = args.artifactType;
    if (args.evidenceRef !== undefined) patch.evidenceRef = args.evidenceRef;
    if (args.verificationNote !== undefined) patch.verificationNote = args.verificationNote;
    if (args.verifiedBy !== undefined) patch.verifiedBy = args.verifiedBy;
    if (args.blockerOwner !== undefined) patch.blockerOwner = args.blockerOwner;
    if (args.blockerReason !== undefined) patch.blockerReason = args.blockerReason;
    if (args.unblockAction !== undefined) patch.unblockAction = args.unblockAction;
    if (args.deadlineAt !== undefined) patch.deadlineAt = args.deadlineAt;
    if (args.decisionRequired !== undefined) patch.decisionRequired = args.decisionRequired;

    if (nextStatus === "done") patch.verifiedAt = now;

    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});
