import { query } from "./_generated/server";
import { v } from "convex/values";

type Edge = {
  from: string;
  to: string;
  type: "mention" | "activity" | "delegation" | "notification";
  count: number;
  lastAt: number;
};

function pushEdge(map: Map<string, Edge>, edge: Omit<Edge, "count">) {
  const key = `${edge.from}->${edge.to}:${edge.type}`;
  const found = map.get(key);
  if (!found) {
    map.set(key, { ...edge, count: 1 });
    return;
  }
  found.count += 1;
  found.lastAt = Math.max(found.lastAt, edge.lastAt);
}

export const interactionsGraph = query({
  args: { windowMinutes: v.optional(v.number()), taskId: v.optional(v.id("tasks")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const since = now - (args.windowMinutes ?? 60) * 60_000;

    const agents = await ctx.db.query("agents").collect();
    const agentById = new Map(agents.map((a) => [a._id, a]));

    const messages = (await ctx.db.query("messages").collect()).filter(
      (m) => m.createdAt >= since && (!args.taskId || m.taskId === args.taskId),
    );
    const notifs = (await ctx.db.query("notifications").collect()).filter(
      (n) => n.createdAt >= since && (!args.taskId || n.taskId === args.taskId),
    );
    const runs = (await ctx.db.query("runs").collect()).filter((r) => r.createdAt >= since && r.trigger === "delegation");

    const edges = new Map<string, Edge>();

    for (const m of messages) {
      const from = m.fromAgentId ? m.fromAgentId : null;
      const mentions = m.mentions ?? [];
      if (from && mentions.length) {
        for (const to of mentions) {
          if (to !== from) pushEdge(edges, { from: String(from), to: String(to), type: "mention", lastAt: m.createdAt });
        }
      }

      if (mentions.length >= 2) {
        for (let i = 0; i < mentions.length - 1; i++) {
          const fromMention = mentions[i];
          const toMention = mentions[i + 1];
          if (fromMention !== toMention) {
            pushEdge(edges, {
              from: String(fromMention),
              to: String(toMention),
              type: "activity",
              lastAt: m.createdAt,
            });
          }
        }
      }
    }

    for (const n of notifs) {
      const to = String(n.mentionedAgentId);
      if (!to) continue;
      const task = n.taskId ? await ctx.db.get(n.taskId) : null;
      const from = task?.assigneeIds?.[0] ? String(task.assigneeIds[0]) : null;
      if (from && from !== to) {
        pushEdge(edges, { from, to, type: "notification", lastAt: n.createdAt });
      }
    }

    for (const r of runs) {
      const to = String(r.agentId);
      const from = agents.find((a) => a.sessionKey === r.sessionKey)?._id;
      if (from && String(from) !== to) pushEdge(edges, { from: String(from), to, type: "delegation", lastAt: r.createdAt });
    }

    const nodes = agents.map((a) => ({
      id: String(a._id),
      sessionKey: a.sessionKey,
      name: a.name,
      role: a.role,
      status: a.status,
      enabled: a.enabled,
      isKnown: agentById.has(a._id),
    }));

    return {
      nodes,
      edges: [...edges.values()].sort((a, b) => b.lastAt - a.lastAt || b.count - a.count),
      since,
      now,
    };
  },
});
