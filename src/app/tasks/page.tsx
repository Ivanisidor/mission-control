"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { assigneeOptionsFromTeam, type Status } from "@/lib/taskBoard";
import type { TeamMember } from "@/lib/team";

const statusLabel: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

type ViewTask = {
  id: string;
  source: "v1" | "legacy";
  title: string;
  status: Status;
  assignee: string;
  evidenceRef?: string;
  blockerReason?: string;
};

type Draft = {
  evidenceRef: string;
  blockerReason: string;
};

const mapV1ToBoardStatus = (s: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked"): Status => {
  if (s === "in_progress") return "in_progress";
  if (s === "blocked") return "blocked";
  if (s === "done") return "done";
  return "todo";
};

export default function TasksPage() {
  const v1Tasks = useQuery(api.tasks.list, {});
  const legacyTasks = useQuery(api.taskBoard.list, {});

  const agents = useQuery(api.agents.list, { enabledOnly: false });
  const teamMembers = useQuery(api.teamMembers.list, {});

  const createV1Task = useMutation(api.tasks.create);
  const assignV1Task = useMutation(api.tasks.assign);
  const transitionV1Task = useMutation(api.tasks.transition);

  const createLegacyTask = useMutation(api.taskBoard.create);
  const updateLegacyTask = useMutation(api.taskBoard.update);

  const [title, setTitle] = useState("");
  const [query] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() ?? "";
  });
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const hasV1Agents = !!agents && agents.length > 0;
  const hasV1Tasks = !!v1Tasks && v1Tasks.length > 0;

  const assigneeOptions = useMemo(() => {
    if (hasV1Agents) {
      return (agents ?? []).map((a) => ({
        id: a._id,
        name: a.name,
        type: a.sessionKey.endsWith(":main") || a.sessionKey === "agent:main" ? "owner" : "subagent",
      }));
    }
    return assigneeOptionsFromTeam((teamMembers ?? []) as TeamMember[]);
  }, [agents, teamMembers, hasV1Agents]);

  const [assignee, setAssignee] = useState<string>("");

  const viewTasks = useMemo<ViewTask[]>(() => {
    if (hasV1Tasks && v1Tasks) {
      return v1Tasks.map((t) => ({
        id: t._id,
        source: "v1",
        title: t.title,
        status: mapV1ToBoardStatus(t.status),
        assignee: t.assigneeIds[0] ?? "",
        evidenceRef: t.evidenceRef,
        blockerReason: t.blockerReason,
      }));
    }

    return (legacyTasks ?? []).map((t) => ({
      id: t._id,
      source: "legacy",
      title: t.title,
      status: t.status,
      assignee: t.assignee,
      evidenceRef: t.evidenceRef,
      blockerReason: t.blockerReason,
    }));
  }, [v1Tasks, legacyTasks, hasV1Tasks]);

  const grouped = useMemo(() => {
    const byStatus: Record<Status, ViewTask[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const t of viewTasks) {
      if (query && !t.title.toLowerCase().includes(query)) continue;
      byStatus[t.status].push(t);
    }
    return byStatus;
  }, [viewTasks, query]);

  const effectiveAssignee = assignee || assigneeOptions[0]?.id || "";

  function getDraft(task: ViewTask): Draft {
    return drafts[task.id] ?? {
      evidenceRef: task.evidenceRef ?? "",
      blockerReason: task.blockerReason ?? "",
    };
  }

  function patchDraft(taskId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...patch } as Draft }));
  }

  function assigneeName(id: string) {
    return assigneeOptions.find((a) => a.id === id)?.name ?? id;
  }

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError("");

    try {
      if (hasV1Agents) {
        await createV1Task({
          title: trimmed,
          description: trimmed,
          assigneeIds: effectiveAssignee ? [effectiveAssignee as Id<"agents">] : [],
          createdBy: "main",
        });
      } else {
        await createLegacyTask({ title: trimmed, assignee: effectiveAssignee || "ivan" });
      }
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add task.");
    }
  }

  async function patchTask(task: ViewTask, patch: { assignee?: string; status?: Status }) {
    const d = getDraft(task);
    setError("");

    try {
      if (task.source === "v1") {
        if (patch.assignee !== undefined) {
          await assignV1Task({ id: task.id as Id<"tasks">, assigneeIds: patch.assignee ? [patch.assignee as Id<"agents">] : [] });
        }

        if (patch.status !== undefined || d.evidenceRef || d.blockerReason) {
          const nextStatus = patch.status ?? task.status;
          const mappedStatus: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked" =
            nextStatus === "todo" ? (patch.assignee ?? task.assignee ? "assigned" : "inbox") : nextStatus;

          await transitionV1Task({
            id: task.id as Id<"tasks">,
            status: mappedStatus,
            evidenceRef: d.evidenceRef || undefined,
            blockerReason: d.blockerReason || undefined,
          });
        }
      } else {
        await updateLegacyTask({
          id: task.id as Id<"taskBoardTasks">,
          ...(patch.assignee !== undefined && { assignee: patch.assignee }),
          ...(patch.status !== undefined && { status: patch.status }),
          evidenceRef: d.evidenceRef,
          blockerReason: d.blockerReason,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update task.");
    }
  }

  const loading = !v1Tasks || !legacyTasks || !agents || !teamMembers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Task Board</h1>
        <p className="text-sm text-muted-foreground">
          {hasV1Tasks ? "Using v1 tasks as primary source." : "Using legacy task board fallback until v1 tasks are present."}
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-medium">Add task</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addTask()} placeholder="What needs to get done?" className="w-full min-w-0 flex-1 rounded-md border px-3 py-2 text-sm sm:min-w-[280px]" />
          <select value={effectiveAssignee} onChange={(e) => setAssignee(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm sm:w-auto">
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button onClick={() => void addTask()} className="w-full rounded-md bg-black px-4 py-2 text-sm text-white sm:w-auto">Add</button>
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700">{error}</div>}

      {loading ? (
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
                    <article key={task.id} className="rounded-md border p-2">
                      <div className="text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">assigned: {assigneeName(task.assignee)}</div>

                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <select value={task.assignee} onChange={(e) => void patchTask(task, { assignee: e.target.value })} className="w-full rounded border px-2 py-1 text-xs sm:w-auto">
                          {assigneeOptions.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        <select value={task.status} onChange={(e) => void patchTask(task, { status: e.target.value as Status })} className="w-full rounded border px-2 py-1 text-xs sm:w-auto">
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>

                      <input value={draft.evidenceRef} onChange={(e) => patchDraft(task.id, { evidenceRef: e.target.value })} placeholder="Evidence URL / path" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <input value={draft.blockerReason} onChange={(e) => patchDraft(task.id, { blockerReason: e.target.value })} placeholder="Blocker reason" className="mt-2 w-full rounded border px-2 py-1 text-[11px]" />
                      <button onClick={() => void patchTask(task, {})} className="mt-2 rounded border px-2 py-1 text-xs">Save details</button>
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
