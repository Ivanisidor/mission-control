import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const teamMemberStatus = v.union(v.literal("ready"), v.literal("active"), v.literal("idle"));
const teamMemberType = v.union(v.literal("core"), v.literal("subagent"));
const discipline = v.union(v.literal("developers"), v.literal("writers"), v.literal("designers"));

const legacySeed: Array<{
  id: string;
  name: string;
  type: "core" | "subagent";
  discipline: "developers" | "writers" | "designers";
  role: string;
  roleBrief: string;
  responsibilities: string[];
  whenToUse: string[];
  status: "ready" | "active" | "idle";
  order: number;
}> = [
  {
    id: "main",
    name: "Nux (main)",
    type: "core",
    discipline: "developers",
    role: "Orchestrator + Integrator",
    roleBrief:
      "You are Nux orchestrating cross-functional delivery. Break work into sub-tasks, delegate to specialist agents, and deliver concise outcomes.",
    responsibilities: [
      "Scope work and route tasks to the right specialist",
      "Handle integration, infra, and final verification",
      "Keep task/calendar/memory up to date",
    ],
    whenToUse: ["Always", "Cross-functional work", "Final review + delivery"],
    status: "active",
    order: 0,
  },
  {
    id: "rex",
    name: "Rex",
    type: "subagent",
    discipline: "developers",
    role: "Developer Agent",
    roleBrief:
      "You are Rex, engineering specialist. Implement backend/frontend code changes safely, with clear diffs and verification steps.",
    responsibilities: ["Implement features and bug fixes", "Refactor code for maintainability", "Run checks and summarize technical outcomes"],
    whenToUse: ["Coding tasks", "Refactors", "Technical debugging"],
    status: "ready",
    order: 1,
  },
  {
    id: "scout",
    name: "Scout",
    type: "subagent",
    discipline: "writers",
    role: "Research + Writing Agent",
    roleBrief:
      "You are Scout, research and writing specialist. Gather facts, synthesize findings, and produce concise documents and summaries.",
    responsibilities: ["Research and summarize information", "Draft docs, plans, and explanations", "Distill notes into decision-ready writing"],
    whenToUse: ["Research", "Documentation", "Structured summaries"],
    status: "ready",
    order: 2,
  },
  {
    id: "hawk",
    name: "Hawk",
    type: "subagent",
    discipline: "designers",
    role: "Design + UX Agent",
    roleBrief:
      "You are Hawk, design and UX specialist. Improve IA, screen flow, and interaction quality while keeping implementation practical.",
    responsibilities: ["Design screen structure and interaction patterns", "Improve UX clarity and visual hierarchy", "Propose design-system level consistency improvements"],
    whenToUse: ["UI/UX design", "Workflow improvements", "Design consistency"],
    status: "ready",
    order: 3,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("teamMembers").collect();
    return members.sort((a, b) => a.order - b.order);
  },
});

export const getByAgentId = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const members = await ctx.db.query("teamMembers").collect();
    return members.find((m) => m.id === args.id) ?? null;
  },
});

export const ensureSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("teamMembers").take(1);
    if (existing.length > 0) return false;

    const now = Date.now();
    for (const m of legacySeed) {
      await ctx.db.insert("teamMembers", { ...m, createdAt: now, updatedAt: now });
    }
    return true;
  },
});

export const upsert = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    type: teamMemberType,
    discipline,
    role: v.string(),
    roleBrief: v.string(),
    responsibilities: v.array(v.string()),
    whenToUse: v.array(v.string()),
    status: teamMemberStatus,
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.query("teamMembers").collect()).find((m) => m.id === args.id) ?? null;
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("teamMembers", { ...args, createdAt: now, updatedAt: now });
  },
});
