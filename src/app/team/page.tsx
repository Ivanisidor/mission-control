"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LEGACY_TEAM_MEMBERS, type TeamMember } from "@/lib/team";

type LegacyBoardTask = {
  assignee: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  updatedAt: number;
  createdAt: number;
};

const disciplineLabels: Record<TeamMember["discipline"], string> = {
  developers: "Developers",
  writers: "Writers",
  designers: "Designers",
};

function fmtHours(h: number | null) {
  if (h === null || Number.isNaN(h)) return "—";
  return `${h.toFixed(1)}h`;
}

function fmtDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function capacityLabel(open: number) {
  if (open >= 6) return { label: "Overloaded", cls: "bg-rose-100 text-rose-700" };
  if (open >= 3) return { label: "Busy", cls: "bg-amber-100 text-amber-700" };
  return { label: "Available", cls: "bg-emerald-100 text-emerald-700" };
}

function statusBadge(status?: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "blocked") return "bg-rose-100 text-rose-700";
  return "bg-zinc-200 text-zinc-700";
}

export default function TeamPage() {
  const v1Tasks = useQuery(api.tasks.list, {});
  const legacyTasks = useQuery(api.taskBoard.list, {});

  const teamMembers = useQuery(api.teamMembers.list, {});
  const agents = useQuery(api.agents.list, { enabledOnly: false });
  const runs = useQuery(api.runs.list, { limit: 300 });

  const ensureTeamSeed = useMutation(api.teamMembers.ensureSeed);

  const [spawnTask, setSpawnTask] = useState("");
  const [spawningMember, setSpawningMember] = useState<string | null>(null);
  const [spawnOutput, setSpawnOutput] = useState<string>("");

  useEffect(() => {
    if (!teamMembers) return;
    if (teamMembers.length === 0) void ensureTeamSeed({});
  }, [teamMembers, ensureTeamSeed]);

  const roster = useMemo(() => {
    if (agents && agents.length > 0) {
      return agents.map((a) => {
        const tail = a.sessionKey.split(":").pop()?.toLowerCase() ?? "";
        const meta = LEGACY_TEAM_MEMBERS.find((m) => m.id === tail);
        return {
          id: tail || a._id,
          name: a.name,
          type: meta?.type ?? "subagent",
          discipline: meta?.discipline ?? "developers",
          role: a.role,
          responsibilities: meta?.responsibilities ?? ["Execution", "Reporting"],
          whenToUse: meta?.whenToUse ?? ["General specialist work"],
          status: a.status,
          sessionKey: a.sessionKey,
          level: a.level,
          agentId: a._id,
        };
      });
    }

    const fallback = (teamMembers && teamMembers.length > 0 ? teamMembers : LEGACY_TEAM_MEMBERS) as TeamMember[];
    return fallback.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      discipline: m.discipline,
      role: m.role,
      responsibilities: m.responsibilities,
      whenToUse: m.whenToUse,
      status: m.status,
      sessionKey: `agent:${m.id}`,
      level: m.id === "main" ? "lead" : "specialist",
      agentId: null,
    }));
  }, [agents, teamMembers]);

  async function spawnWithRole(memberId: string) {
    setSpawningMember(memberId);
    const res = await fetch("/api/team/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, task: spawnTask.trim() || undefined }),
    });
    const data = (await res.json()) as { ok: boolean; output?: string; error?: string; member?: string };
    setSpawningMember(null);
    if (!data.ok) {
      setSpawnOutput(`Spawn failed: ${data.error ?? "unknown error"}`);
      return;
    }
    setSpawnOutput(`Spawned ${data.member}.\n\n${data.output ?? ""}`);
  }

  const runStats = useMemo(() => {
    const byMember = new Map<string, {
      totalAssigned: number;
      openAssigned: number;
      completed: number;
      lastCompletedAt: number | null;
      avgCompletionHours: number | null;
    }>();

    for (const member of roster) {
      byMember.set(member.id, {
        totalAssigned: 0,
        openAssigned: 0,
        completed: 0,
        lastCompletedAt: null,
        avgCompletionHours: null,
      });
    }

    const hasV1 = !!v1Tasks && v1Tasks.length > 0;

    if (hasV1 && v1Tasks) {
      const agentById = new Map((agents ?? []).map((a) => [a._id, a]));
      for (const t of v1Tasks) {
        const ids = t.assigneeIds ?? [];
        for (const agentId of ids) {
          const agent = agentById.get(agentId);
          const tail = agent?.sessionKey.split(":").pop()?.toLowerCase();
          if (!tail) continue;
          const bucket = byMember.get(tail);
          if (!bucket) continue;
          bucket.totalAssigned += 1;
          if (t.status !== "done") bucket.openAssigned += 1;
          if (t.status === "done") {
            bucket.completed += 1;
            if (!bucket.lastCompletedAt || t.updatedAt > bucket.lastCompletedAt) bucket.lastCompletedAt = t.updatedAt;
          }
        }
      }

      for (const member of roster) {
        const agent = (agents ?? []).find((a) => (a.sessionKey.split(":").pop()?.toLowerCase() ?? "") === member.id);
        if (!agent) continue;
        const doneTasks = v1Tasks.filter((t) => t.assigneeIds.includes(agent._id) && t.status === "done");
        const times = doneTasks.map((t) => (t.updatedAt - t.createdAt) / 36e5).filter((h) => Number.isFinite(h) && h >= 0);
        const bucket = byMember.get(member.id);
        if (bucket && times.length) bucket.avgCompletionHours = times.reduce((a, b) => a + b, 0) / times.length;
      }

      return byMember;
    }

    for (const t of ((legacyTasks ?? []) as LegacyBoardTask[])) {
      const bucket = byMember.get(t.assignee);
      if (!bucket) continue;
      bucket.totalAssigned += 1;
      if (t.status !== "done") bucket.openAssigned += 1;
      if (t.status === "done") {
        bucket.completed += 1;
        if (!bucket.lastCompletedAt || t.updatedAt > bucket.lastCompletedAt) bucket.lastCompletedAt = t.updatedAt;
      }
    }

    return byMember;
  }, [v1Tasks, legacyTasks, roster, agents]);

  const groups = useMemo(() => ({
    developers: roster.filter((m) => m.discipline === "developers"),
    writers: roster.filter((m) => m.discipline === "writers"),
    designers: roster.filter((m) => m.discipline === "designers"),
  }), [roster]);

  const capacityRows = roster
    .map((m) => {
      const stats = runStats.get(m.id);
      const open = stats?.openAssigned ?? 0;
      return { member: m, stats, open, cap: capacityLabel(open) };
    })
    .sort((a, b) => b.open - a.open);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team Structure</h1>
        <p className="text-sm text-muted-foreground">
          {agents && agents.length > 0
            ? "Using v1 agents as primary source."
            : "Using legacy teamMembers fallback until v1 agents are available."}
        </p>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-semibold">One-click spawn with role brief</h3>
        <p className="mt-1 text-xs text-muted-foreground">Optional task prompt applied to whichever role you spawn.</p>
        <input
          value={spawnTask}
          onChange={(e) => setSpawnTask(e.target.value)}
          placeholder="Optional task for role spawn…"
          className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
        />
        {spawnOutput ? (
          <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-wrap">{spawnOutput}</pre>
        ) : null}
      </section>

      {(Object.keys(groups) as Array<keyof typeof groups>).map((discipline) => (
        <section key={discipline} className="space-y-3">
          <h2 className="text-lg font-semibold">{disciplineLabels[discipline]}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {groups[discipline].map((member) => {
              const stats = runStats.get(member.id);
              const lastRun = runs?.find((r) => (r.sessionKey.split(":").pop()?.toLowerCase() ?? "") === member.id);
              return (
                <article key={member.sessionKey} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.role} · {member.type}</div>
                    </div>
                    <span className={`rounded px-2 py-1 text-[11px] font-medium ${statusBadge(member.status)}`}>
                      {member.status}
                    </span>
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={() => void spawnWithRole(member.id)}
                      disabled={spawningMember === member.id}
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {spawningMember === member.id ? "Spawning…" : "Spawn with role brief"}
                    </button>
                  </div>

                  <div className="mt-3 rounded-lg border bg-zinc-50 p-2 text-[11px]">
                    <div className="text-zinc-500">Session</div>
                    <div className="font-mono">{member.sessionKey}</div>
                    <div className="mt-1 text-zinc-500">Level · last run</div>
                    <div className="font-medium">{member.level} · {lastRun ? `${lastRun.status} (${new Date(lastRun.updatedAt ?? lastRun.createdAt).toLocaleString()})` : "none"}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border bg-zinc-50 p-2 text-[11px]">
                    <div><div className="text-zinc-500">Open tasks</div><div className="font-semibold">{stats?.openAssigned ?? 0}</div></div>
                    <div><div className="text-zinc-500">Completed</div><div className="font-semibold">{stats?.completed ?? 0}</div></div>
                    <div><div className="text-zinc-500">Last completion</div><div className="font-semibold">{fmtDate(stats?.lastCompletedAt ?? null)}</div></div>
                    <div><div className="text-zinc-500">Avg completion</div><div className="font-semibold">{fmtHours(stats?.avgCompletionHours ?? null)}</div></div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-semibold">Capacity view</h3>
        <div className="mt-3 space-y-2">
          {capacityRows.map((row) => (
            <div key={row.member.sessionKey} className="flex items-center justify-between rounded-lg border p-2 text-xs">
              <div>
                <div className="font-medium">{row.member.name}</div>
                <div className="text-muted-foreground">open: {row.open} · completed: {row.stats?.completed ?? 0}</div>
              </div>
              <span className={`rounded px-2 py-1 ${row.cap.cls}`}>{row.cap.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
