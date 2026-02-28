"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LEGACY_TEAM_MEMBERS, type TeamMember } from "@/lib/team";

/* ── agent visual config ── */
const agentMeta: Record<string, { emoji: string; color: string; deskX: number; deskY: number }> = {
  ivan:  { emoji: "👤", color: "#6366f1", deskX: 400, deskY: 80  },
  main:  { emoji: "🧠", color: "#10b981", deskX: 160, deskY: 200 },
  rex:   { emoji: "🦖", color: "#f59e0b", deskX: 400, deskY: 200 },
  scout: { emoji: "🔍", color: "#3b82f6", deskX: 640, deskY: 200 },
  hawk:  { emoji: "🦅", color: "#ef4444", deskX: 160, deskY: 360 },
  nova:  { emoji: "✨", color: "#a855f7", deskX: 400, deskY: 360 },
  cris:  { emoji: "🥗", color: "#14b8a6", deskX: 640, deskY: 360 },
};

type TaskLike = {
  assignee: string;
  status: string;
  title: string;
  project?: string;
};

type InteractionEdge = {
  from: string;
  to: string;
  type: "mention" | "activity" | "project";
  count: number;
  lastAt: number;
};

function projectColor(project: string): string {
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
  let hash = 0;
  for (let i = 0; i < project.length; i++) hash = (hash * 31 + project.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function edgeColor(edge: InteractionEdge): string {
  if (edge.type === "mention") return "#22c55e";
  if (edge.type === "activity") return "#0ea5e9";
  return projectColor(`${edge.from}-${edge.to}`);
}

function mergeEdge(map: Map<string, InteractionEdge>, edge: Omit<InteractionEdge, "count" | "lastAt"> & { lastAt: number }) {
  const key = `${edge.from}->${edge.to}:${edge.type}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...edge, count: 1 });
    return;
  }
  existing.count += 1;
  existing.lastAt = Math.max(existing.lastAt, edge.lastAt);
}

export default function OfficePage() {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [windowMinutes, setWindowMinutes] = useState<number>(60);

  const tasks = useQuery(api.taskBoard.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});
  const activityEvents = useQuery(api.activityEvents.list, { limit: 200 });
  const officeGraph = useQuery(api.office.interactionsGraph, { windowMinutes });

  const members = (teamMembers && teamMembers.length > 0 ? teamMembers : LEGACY_TEAM_MEMBERS) as TeamMember[];

  // Build collaboration links and interaction edges
  const { collabLinks, interactionLinks, hasInteractions, agentProjects, agentTasks } = useMemo(() => {
    const taskList = (tasks ?? []) as TaskLike[];
    const activeTasks = taskList.filter((t) => t.status === "in_progress" || t.status === "todo");

    // Map agent → active projects/tasks
    const ap = new Map<string, Set<string>>();
    const at = new Map<string, TaskLike[]>();
    for (const t of activeTasks) {
      const proj = t.project || "default";
      if (!ap.has(t.assignee)) ap.set(t.assignee, new Set());
      ap.get(t.assignee)!.add(proj);
      if (!at.has(t.assignee)) at.set(t.assignee, []);
      at.get(t.assignee)!.push(t);
    }

    // Project-based fallback links
    const projectLinks: InteractionEdge[] = [];
    const agents = [...ap.keys()];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const sharedCount = [...ap.get(agents[i])!].filter((proj) => ap.get(agents[j])!.has(proj)).length;
        if (sharedCount > 0) {
          projectLinks.push({ from: agents[i], to: agents[j], type: "project", count: sharedCount, lastAt: Date.now() });
        }
      }
    }

    // Activity-based interaction links
    const since = Date.now() - windowMinutes * 60_000;
    const edgeMap = new Map<string, InteractionEdge>();
    const knownIds = new Set<string>(["ivan", ...members.map((m) => m.id)]);

    const aliases = new Map<string, string>();
    aliases.set("@ivan", "ivan");
    aliases.set("ivan", "ivan");
    for (const m of members) {
      aliases.set(m.id.toLowerCase(), m.id);
      aliases.set(`@${m.id.toLowerCase()}`, m.id);
      aliases.set(m.name.toLowerCase(), m.id);
      aliases.set(m.name.split(" ")[0].toLowerCase(), m.id);
    }

    for (const e of activityEvents ?? []) {
      if (e.createdAt < since) continue;
      const text = `${e.summary ?? ""} ${JSON.stringify(e.details ?? "")}`.toLowerCase();
      if (!text.trim()) continue;

      const mentions = [...text.matchAll(/@([a-z0-9_-]+)/g)]
        .map((m) => m[1])
        .map((id) => aliases.get(`@${id}`) ?? aliases.get(id) ?? id)
        .filter((id) => knownIds.has(id));

      const orderedMentions: Array<{ id: string; index: number }> = [];
      aliases.forEach((id, alias) => {
        const idx = text.indexOf(alias);
        if (idx >= 0 && knownIds.has(id)) orderedMentions.push({ id, index: idx });
      });
      orderedMentions.sort((a, b) => a.index - b.index);
      const uniqueOrdered = orderedMentions.filter((v, i, arr) => i === arr.findIndex((x) => x.id === v.id));

      if (mentions.length >= 1 && uniqueOrdered.length >= 1) {
        const from = uniqueOrdered[0]?.id;
        for (const to of mentions) {
          if (from && to && from !== to) mergeEdge(edgeMap, { from, to, type: "mention", lastAt: e.createdAt });
        }
      }

      if (uniqueOrdered.length >= 2) {
        for (let i = 0; i < uniqueOrdered.length - 1; i++) {
          const from = uniqueOrdered[i].id;
          const to = uniqueOrdered[i + 1].id;
          if (from !== to) mergeEdge(edgeMap, { from, to, type: "activity", lastAt: e.createdAt });
        }
      }
    }

    const serverAlias = new Map<string, string>();
    for (const node of officeGraph?.nodes ?? []) {
      const tail = String(node.sessionKey ?? "").split(":")[1]?.toLowerCase();
      if (tail) serverAlias.set(String(node.id), tail === "main" ? "main" : tail);
    }

    for (const edge of officeGraph?.edges ?? []) {
      const from = serverAlias.get(String(edge.from));
      const to = serverAlias.get(String(edge.to));
      if (!from || !to || from === to || !knownIds.has(from) || !knownIds.has(to)) continue;
      mergeEdge(edgeMap, {
        from,
        to,
        type: edge.type === "mention" ? "mention" : "activity",
        lastAt: edge.lastAt,
      });
    }

    const interactions = [...edgeMap.values()].sort((a, b) => b.lastAt - a.lastAt || b.count - a.count);
    return {
      collabLinks: projectLinks,
      interactionLinks: interactions,
      hasInteractions: interactions.length > 0,
      agentProjects: ap,
      agentTasks: at,
    };
  }, [tasks, activityEvents, members, officeGraph, windowMinutes]);

  const board = useMemo(() => {
    const list = (tasks ?? []) as TaskLike[];
    return {
      todo: list.filter((t) => t.status === "todo").length,
      inProgress: list.filter((t) => t.status === "in_progress").length,
      blocked: list.filter((t) => t.status === "blocked").length,
      done: list.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  // Determine effective status per agent from their tasks
  const agentStatus = useMemo(() => {
    const s = new Map<string, "active" | "ready" | "idle">();
    for (const m of members) {
      const memberTasks = agentTasks.get(m.id);
      if (memberTasks && memberTasks.some((t) => t.status === "in_progress")) {
        s.set(m.id, "active");
      } else if (memberTasks && memberTasks.length > 0) {
        s.set(m.id, "ready");
      } else {
        s.set(m.id, "idle");
      }
    }
    // Ivan is always active
    s.set("ivan", "active");
    return s;
  }, [members, agentTasks]);

  const detail = selectedAgent || hoveredAgent;
  const detailMember = detail ? members.find((m) => m.id === detail) : null;
  const detailMeta = detail ? agentMeta[detail] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Office</h1>
        <p className="text-sm text-muted-foreground">Live animated team workspace. Interaction lines appear when agent-to-agent activity exists in the selected time window.</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Interaction window:</span>
        <select
          className="rounded-md border bg-white px-2 py-1"
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(Number(e.target.value))}
        >
          <option value={15}>Last 15m</option>
          <option value={60}>Last 1h</option>
          <option value={240}>Last 4h</option>
          <option value={1440}>Last 24h</option>
        </select>
        <span className="text-muted-foreground">
          {hasInteractions ? `Showing ${interactionLinks.length} interaction link${interactionLinks.length === 1 ? "" : "s"}` : "No interactions found, showing project collaboration"}
        </span>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Team" value={members.length + 1} sub="members" />
        <Stat label="Active" value={board.inProgress} sub="in progress" />
        <Stat label="Queued" value={board.todo} sub="to do" />
        <Stat label="Done" value={board.done} sub="completed" />
      </div>

      {officeGraph && (
        <div className="rounded-xl border bg-white p-3 text-xs text-muted-foreground">
          Observability snapshot: {officeGraph.nodes.length} agent nodes, {officeGraph.edges.length} server-derived edges,
          updated for last {windowMinutes}m.
        </div>
      )}

      {/* Animated office floor */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-inner" style={{ minHeight: 480 }}>
        {/* Grid pattern background */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Collaboration / interaction lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {(hasInteractions ? interactionLinks : collabLinks).map((link, i) => {
            const fromMeta = agentMeta[link.from];
            const toMeta = agentMeta[link.to];
            if (!fromMeta || !toMeta) return null;
            const color = edgeColor(link);
            const label = link.type === "project" ? "project" : `${link.type} ×${link.count}`;
            return (
              <g key={`${link.from}-${link.to}-${link.type}-${i}`}>
                <line
                  x1={fromMeta.deskX}
                  y1={fromMeta.deskY}
                  x2={toMeta.deskX}
                  y2={toMeta.deskY}
                  stroke={color}
                  strokeWidth={link.type === "mention" ? "2.5" : "2"}
                  strokeDasharray={link.type === "activity" ? "6 4" : undefined}
                  opacity="0.45"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-20"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </line>
                <text
                  x={(fromMeta.deskX + toMeta.deskX) / 2}
                  y={(fromMeta.deskY + toMeta.deskY) / 2 - 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize="10"
                  fontWeight="600"
                  opacity="0.8"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Ivan's desk (special) */}
        <AgentDesk
          id="ivan"
          name="Ivan"
          role="Owner"
          meta={agentMeta.ivan}
          status={agentStatus.get("ivan") ?? "active"}
          projects={agentProjects.get("ivan")}
          isHovered={detail === "ivan"}
          onHover={setHoveredAgent}
          onClick={setSelectedAgent}
        />

        {/* Agent desks */}
        {members.map((m) => {
          const meta = agentMeta[m.id];
          if (!meta) return null;
          return (
            <AgentDesk
              key={m.id}
              id={m.id}
              name={m.name}
              role={m.role}
              meta={meta}
              status={agentStatus.get(m.id) ?? "idle"}
              projects={agentProjects.get(m.id)}
              isHovered={detail === m.id}
              onHover={setHoveredAgent}
              onClick={setSelectedAgent}
            />
          );
        })}
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="rounded-xl border bg-white p-4 shadow-sm transition-all">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{detailMeta?.emoji ?? "👤"}</span>
            <div>
              <div className="text-sm font-semibold">{detailMember?.name ?? "Ivan"}</div>
              <div className="text-xs text-muted-foreground">{detailMember?.role ?? "Owner"}</div>
            </div>
            <span
              className="ml-auto rounded-full px-2 py-1 text-[10px] font-medium"
              style={{ backgroundColor: `${detailMeta?.color}20`, color: detailMeta?.color }}
            >
              {agentStatus.get(detail) ?? "idle"}
            </span>
          </div>

          {agentTasks.get(detail) && agentTasks.get(detail)!.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-zinc-500">Active Work</div>
              <ul className="mt-1 space-y-1">
                {agentTasks.get(detail)!.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: projectColor(t.project || "default") }}
                    />
                    <span className="font-medium">[{t.project || "default"}]</span>
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(!agentTasks.get(detail) || agentTasks.get(detail)!.length === 0) && (
            <div className="mt-3 text-xs text-muted-foreground">No active tasks right now.</div>
          )}
        </div>
      )}

      {/* Recent activity feed */}
      {activityEvents && activityEvents.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          <div className="mt-3 space-y-2">
            {activityEvents.slice(0, 8).map((e) => (
              <div key={e._id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <span className="font-medium">{e.summary}</span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> Ready
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-300" /> Idle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-6 border-t-2 border-dashed border-sky-500" /> Activity link
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-6 border-t-2 border-emerald-500" /> Mention link
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-6 border-t-2 border-indigo-400" /> Project fallback
        </span>
      </div>
    </div>
  );
}

/* ── Agent Desk Component ── */
function AgentDesk({
  id, name, role, meta, status, projects, isHovered, onHover, onClick,
}: {
  id: string;
  name: string;
  role: string;
  meta: { emoji: string; color: string; deskX: number; deskY: number };
  status: "active" | "ready" | "idle";
  projects?: Set<string>;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string | null) => void;
}) {
  const ringColor = status === "active" ? "ring-emerald-400" : status === "ready" ? "ring-blue-300" : "ring-zinc-200";
  const pulseClass = status === "active" ? "animate-pulse" : "";
  const scale = isHovered ? "scale-110" : "scale-100";

  return (
    <div
      className={`absolute flex cursor-pointer flex-col items-center transition-transform duration-300 ${scale}`}
      style={{ left: meta.deskX - 48, top: meta.deskY - 36, width: 96 }}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(id)}
    >
      {/* Desk surface */}
      <div
        className="rounded-xl border-2 bg-white/80 px-3 py-2 shadow-md backdrop-blur transition-shadow duration-300"
        style={{
          borderColor: isHovered ? meta.color : "#e5e7eb",
          boxShadow: isHovered ? `0 0 20px ${meta.color}30` : undefined,
        }}
      >
        {/* Avatar with status ring */}
        <div className="flex justify-center">
          <div className={`relative rounded-full ring-2 ${ringColor} p-1`}>
            <span className="text-2xl">{meta.emoji}</span>
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${pulseClass}`}
              style={{
                backgroundColor: status === "active" ? "#10b981" : status === "ready" ? "#3b82f6" : "#9ca3af",
              }}
            />
          </div>
        </div>

        {/* Name */}
        <div className="mt-1 text-center text-[11px] font-semibold" style={{ color: meta.color }}>
          {name.split(" ")[0]}
        </div>

        {/* Role (shown on hover) */}
        {isHovered && (
          <div className="mt-0.5 text-center text-[9px] text-muted-foreground">{role}</div>
        )}
      </div>

      {/* Project badges below desk */}
      {projects && projects.size > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-0.5">
          {[...projects].slice(0, 2).map((p) => (
            <span
              key={p}
              className="rounded px-1 py-0.5 text-[8px] font-medium text-white"
              style={{ backgroundColor: projectColor(p) }}
            >
              {p.length > 10 ? p.slice(0, 10) + "…" : p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
