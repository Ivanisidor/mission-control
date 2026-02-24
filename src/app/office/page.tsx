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

const statusPulse: Record<string, string> = {
  active: "animate-pulse",
  ready: "",
  idle: "opacity-60",
};

type TaskLike = {
  assignee: string;
  status: string;
  title: string;
  project?: string;
};

function projectColor(project: string): string {
  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
  let hash = 0;
  for (let i = 0; i < project.length; i++) hash = (hash * 31 + project.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export default function OfficePage() {
  const tasks = useQuery(api.taskBoard.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});
  const activityEvents = useQuery(api.activityEvents.list, { limit: 20 });

  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const members = (teamMembers && teamMembers.length > 0 ? teamMembers : LEGACY_TEAM_MEMBERS) as TeamMember[];

  // Build collaboration links: agents sharing same active project
  const { collabLinks, agentProjects, agentTasks } = useMemo(() => {
    const taskList = (tasks ?? []) as TaskLike[];
    const activeTasks = taskList.filter((t) => t.status === "in_progress" || t.status === "todo");

    // Map agent → active projects
    const ap = new Map<string, Set<string>>();
    const at = new Map<string, TaskLike[]>();
    for (const t of activeTasks) {
      const proj = t.project || "default";
      if (!ap.has(t.assignee)) ap.set(t.assignee, new Set());
      ap.get(t.assignee)!.add(proj);
      if (!at.has(t.assignee)) at.set(t.assignee, []);
      at.get(t.assignee)!.push(t);
    }

    // Find pairs sharing a project
    const links: Array<{ from: string; to: string; project: string }> = [];
    const agents = [...ap.keys()];
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const shared = [...ap.get(agents[i])!].filter((p) => ap.get(agents[j])!.has(p));
        for (const p of shared) {
          links.push({ from: agents[i], to: agents[j], project: p });
        }
      }
    }

    return { collabLinks: links, agentProjects: ap, agentTasks: at };
  }, [tasks]);

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
        <p className="text-sm text-muted-foreground">Live animated team workspace. Lines connect agents collaborating on the same project.</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Team" value={members.length + 1} sub="members" />
        <Stat label="Active" value={board.inProgress} sub="in progress" />
        <Stat label="Queued" value={board.todo} sub="to do" />
        <Stat label="Done" value={board.done} sub="completed" />
      </div>

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

        {/* Collaboration lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {collabLinks.map((link, i) => {
            const fromMeta = agentMeta[link.from];
            const toMeta = agentMeta[link.to];
            if (!fromMeta || !toMeta) return null;
            const color = projectColor(link.project);
            return (
              <g key={`${link.from}-${link.to}-${link.project}-${i}`}>
                <line
                  x1={fromMeta.deskX}
                  y1={fromMeta.deskY}
                  x2={toMeta.deskX}
                  y2={toMeta.deskY}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  opacity="0.4"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-20"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </line>
                {/* Project label at midpoint */}
                <text
                  x={(fromMeta.deskX + toMeta.deskX) / 2}
                  y={(fromMeta.deskY + toMeta.deskY) / 2 - 8}
                  textAnchor="middle"
                  fill={color}
                  fontSize="10"
                  fontWeight="600"
                  opacity="0.7"
                >
                  {link.project}
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
          <span className="inline-block h-1 w-6 border-t-2 border-dashed border-indigo-400" /> Collaborating
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
