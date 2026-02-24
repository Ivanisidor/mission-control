"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { assigneeName, assigneeOptionsFromTeam, type Status } from "@/lib/taskBoard";
import type { TeamMember } from "@/lib/team";

const statusLabel: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

type BoardTask = {
  _id: Id<"taskBoardTasks">;
  title: string;
  status: Status;
  assignee: string;
  evidenceRef?: string;
  verificationNote?: string;
  verifiedBy?: string;
  blockerOwner?: string;
  blockerReason?: string;
  unblockAction?: string;
  deadlineAt?: number;
};

type Draft = {
  evidenceRef: string;
  verificationNote: string;
  verifiedBy: string;
  blockerOwner: string;
  blockerReason: string;
  unblockAction: string;
  deadlineAt: string;
};

export default function TasksPage() {
  const tasks = useQuery(api.taskBoard.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});

  const ensureTaskSeed = useMutation(api.taskBoard.ensureSeed);
  const ensureTeamSeed = useMutation(api.teamMembers.ensureSeed);
  const createTask = useMutation(api.taskBoard.create);
  const updateTask = useMutation(api.taskBoard.update);

  const assigneeOptions = useMemo(() => assigneeOptionsFromTeam((teamMembers ?? []) as TeamMember[]), [teamMembers]);

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("ivan");
  const [query] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() ?? "";
  });
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    if (!teamMembers) return;
    if (teamMembers.length === 0) void ensureTeamSeed({});
  }, [teamMembers, ensureTeamSeed]);

  useEffect(() => {
    if (!tasks) return;
    if (tasks.length === 0) void ensureTaskSeed({});
  }, [tasks, ensureTaskSeed]);

  const grouped = useMemo(() => {
    const byStatus: Record<Status, BoardTask[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    if (!tasks) return byStatus;
    for (const t of tasks) {
      if (query && !t.title.toLowerCase().includes(query)) continue;
      byStatus[t.status].push(t as BoardTask);
    }
    return byStatus;
  }, [tasks, query]);

  function getDraft(task: BoardTask): Draft {
    return drafts[task._id] ?? {
      evidenceRef: task.evidenceRef ?? "",
      verificationNote: task.verificationNote ?? "",
      verifiedBy: task.verifiedBy ?? "",
      blockerOwner: task.blockerOwner ?? "",
      blockerReason: task.blockerReason ?? "",
      unblockAction: task.unblockAction ?? "",
      deadlineAt: task.deadlineAt ? new Date(task.deadlineAt).toISOString().slice(0, 16) : "",
    };
  }

  function patchDraft(taskId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } as Draft }));
  }

  function addTask() {
    const trimmed = title.trim();
    if (!trimmed) return;
    void createTask({ title: trimmed, assignee });
    setTitle("");
  }

  async function saveDetails(task: BoardTask) {
    const d = getDraft(task);
    setError("");
    try {
      await updateTask({
        id: task._id,
        evidenceRef: d.evidenceRef,
        verificationNote: d.verificationNote,
        verifiedBy: d.verifiedBy,
        blockerOwner: d.blockerOwner,
        blockerReason: d.blockerReason,
        unblockAction: d.unblockAction,
        deadlineAt: d.deadlineAt ? new Date(d.deadlineAt).getTime() : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save task details.");
    }
  }

  async function patchTask(id: Id<"taskBoardTasks">, task: BoardTask, patch: { assignee?: string; status?: Status }) {
    const d = getDraft(task);
    setError("");
    try {
      await updateTask({
        id,
        ...patch,
        evidenceRef: d.evidenceRef,
        verificationNote: d.verificationNote,
        verifiedBy: d.verifiedBy,
        blockerOwner: d.blockerOwner,
        blockerReason: d.blockerReason,
        unblockAction: d.unblockAction,
        deadlineAt: d.deadlineAt ? new Date(d.deadlineAt).getTime() : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Task Board</h1>
        <p className="text-sm text-muted-foreground">Track work by status and assign tasks to Ivan or any team member.</p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Add task</div>
        <div className="flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="What needs to get done?" className="min-w-[280px] flex-1 rounded-md border px-3 py-2 text-sm" />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button onClick={addTask} className="rounded-md bg-black px-4 py-2 text-sm text-white">Add</button>
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">{error}</div>}

      {!tasks || !teamMembers ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Loading tasks…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(statusLabel) as Status[]).map((status) => (
            <section key={status} className="rounded-lg border bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{statusLabel[status]}</h2>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{grouped[status].length}</span>
              </div>

              <div className="space-y-2">
                {grouped[status].map((task) => {
                  const draft = getDraft(task);
                  return (
                    <article key={task._id} className="rounded-md border p-2">
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">assigned: {assigneeName(task.assignee, assigneeOptions)}</div>
                      <div className="mt-2 flex gap-2">
                        <select value={task.assignee} onChange={(e) => void patchTask(task._id, task, { assignee: e.target.value })} className="rounded border px-2 py-1 text-xs">
                          {assigneeOptions.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        <select value={task.status} onChange={(e) => void patchTask(task._id, task, { status: e.target.value as Status })} className="rounded border px-2 py-1 text-xs">
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>

                      <input value={draft.evidenceRef} onChange={(e) => patchDraft(task._id, { evidenceRef: e.target.value })} placeholder="Evidence URL / path" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input value={draft.verificationNote} onChange={(e) => patchDraft(task._id, { verificationNote: e.target.value })} placeholder="Verification note" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input value={draft.verifiedBy} onChange={(e) => patchDraft(task._id, { verifiedBy: e.target.value })} placeholder="Verified by" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />

                      <input value={draft.blockerOwner} onChange={(e) => patchDraft(task._id, { blockerOwner: e.target.value })} placeholder="Blocker owner" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input value={draft.blockerReason} onChange={(e) => patchDraft(task._id, { blockerReason: e.target.value })} placeholder="Blocker reason" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input value={draft.unblockAction} onChange={(e) => patchDraft(task._id, { unblockAction: e.target.value })} placeholder="Unblock action" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input type="datetime-local" value={draft.deadlineAt} onChange={(e) => patchDraft(task._id, { deadlineAt: e.target.value })} className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />

                      <button onClick={() => void saveDetails(task)} className="mt-2 rounded border px-2 py-1 text-xs">Save details</button>
                    </article>
                  );
                })}
                {grouped[status].length === 0 && <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No tasks</div>}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
