"use client";

import { useMemo, useState } from "react";
import { TASK_STORAGE_KEY, type Task } from "@/lib/taskBoard";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";

const disciplineLabels: Record<TeamMember["discipline"], string> = {
  developers: "Developers",
  writers: "Writers",
  designers: "Designers",
};

const statusStyle: Record<TeamMember["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  ready: "bg-blue-100 text-blue-700",
  idle: "bg-zinc-200 text-zinc-700",
};

function fmtHours(h: number | null) {
  if (h === null || Number.isNaN(h)) return "—";
  return `${h.toFixed(1)}h`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function capacityLabel(open: number) {
  if (open >= 6) return { label: "Overloaded", cls: "bg-rose-100 text-rose-700" };
  if (open >= 3) return { label: "Busy", cls: "bg-amber-100 text-amber-700" };
  return { label: "Available", cls: "bg-emerald-100 text-emerald-700" };
}

export default function TeamPage() {
  const [tasks] = useState<Task[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch {
      return [];
    }
  });

  const [spawnTask, setSpawnTask] = useState("");
  const [spawningMember, setSpawningMember] = useState<string | null>(null);
  const [spawnOutput, setSpawnOutput] = useState<string>("");

  async function spawnWithRole(member: TeamMember) {
    setSpawningMember(member.id);
    const res = await fetch("/api/team/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, task: spawnTask.trim() || undefined }),
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
    const byMember = new Map<
      string,
      {
        totalAssigned: number;
        openAssigned: number;
        completed: number;
        lastCompletedAt: string | null;
        avgCompletionHours: number | null;
      }
    >();

    for (const member of TEAM_MEMBERS) {
      byMember.set(member.id, {
        totalAssigned: 0,
        openAssigned: 0,
        completed: 0,
        lastCompletedAt: null,
        avgCompletionHours: null,
      });
    }

    for (const t of tasks) {
      const bucket = byMember.get(t.assignee);
      if (!bucket) continue;
      bucket.totalAssigned += 1;
      if (t.status !== "done") bucket.openAssigned += 1;
      if (t.status === "done") {
        bucket.completed += 1;
        if (!bucket.lastCompletedAt || new Date(t.updatedAt).getTime() > new Date(bucket.lastCompletedAt).getTime()) {
          bucket.lastCompletedAt = t.updatedAt;
        }
      }
    }

    for (const member of TEAM_MEMBERS) {
      const memberTasks = tasks.filter((t) => t.assignee === member.id && t.status === "done");
      const times = memberTasks
        .map((t) => (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 36e5)
        .filter((h) => Number.isFinite(h) && h >= 0);

      const bucket = byMember.get(member.id);
      if (!bucket) continue;
      if (times.length) bucket.avgCompletionHours = times.reduce((a, b) => a + b, 0) / times.length;
    }

    return byMember;
  }, [tasks]);

  const groups = {
    developers: TEAM_MEMBERS.filter((m) => m.discipline === "developers"),
    writers: TEAM_MEMBERS.filter((m) => m.discipline === "writers"),
    designers: TEAM_MEMBERS.filter((m) => m.discipline === "designers"),
  } as const;

  const capacityRows = TEAM_MEMBERS.map((m) => {
    const stats = runStats.get(m.id);
    const open = stats?.openAssigned ?? 0;
    return { member: m, stats, open, cap: capacityLabel(open) };
  }).sort((a, b) => b.open - a.open);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team Structure</h1>
        <p className="text-sm text-muted-foreground">
          Core operator + role-specialized subagents used for delivery. Organized by discipline.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-semibold">One-click spawn with role brief</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Optional task prompt applied to whichever role you spawn.
        </p>
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
              return (
                <article key={member.id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">{member.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.role} · {member.type}
                      </div>
                    </div>
                    <span className={`rounded px-2 py-1 text-[11px] font-medium ${statusStyle[member.status]}`}>
                      {member.status}
                    </span>
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={() => void spawnWithRole(member)}
                      disabled={spawningMember === member.id}
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {spawningMember === member.id ? "Spawning…" : "Spawn with role brief"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border bg-zinc-50 p-2 text-[11px]">
                    <div>
                      <div className="text-zinc-500">Open tasks</div>
                      <div className="font-semibold">{stats?.openAssigned ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Completed</div>
                      <div className="font-semibold">{stats?.completed ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Last completion</div>
                      <div className="font-semibold">{fmtDate(stats?.lastCompletedAt ?? null)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">Avg completion</div>
                      <div className="font-semibold">{fmtHours(stats?.avgCompletionHours ?? null)}</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase text-zinc-600">Responsibilities</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-zinc-700">
                      {member.responsibilities.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase text-zinc-600">Use when</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {member.whenToUse.map((w) => (
                        <span key={w} className="rounded bg-zinc-100 px-2 py-1 text-[11px] text-zinc-700">
                          {w}
                        </span>
                      ))}
                    </div>
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
            <div key={row.member.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
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
