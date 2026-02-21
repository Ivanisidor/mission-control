"use client";

import { useEffect, useMemo, useState } from "react";
import { ASSIGNEE_OPTIONS, assigneeName, TASK_STORAGE_KEY, type Status, type Task } from "@/lib/taskBoard";

const LEGACY_KEY = "mission-control-task-board-v1";

const statusLabel: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function nowIso() {
  return new Date().toISOString();
}

function seedTasks(): Task[] {
  const n = nowIso();
  return [
    { id: cryptoRandomId(), title: "Fix WSL Docker credential helper mismatch", status: "done", assignee: "nux-core", createdAt: n, updatedAt: n },
    { id: cryptoRandomId(), title: "Approve gateway device pairing scope upgrade", status: "done", assignee: "nux-core", createdAt: n, updatedAt: n },
    { id: cryptoRandomId(), title: "Verify multi-agent smoke test after config changes", status: "done", assignee: "nux-core", createdAt: n, updatedAt: n },
    { id: cryptoRandomId(), title: "Move manual calendar events from local storage to Convex", status: "done", assignee: "dev-backend", createdAt: n, updatedAt: n },
    { id: cryptoRandomId(), title: "Review and prioritize next project tasks", status: "todo", assignee: "ivan", createdAt: n, updatedAt: n },
  ];
}

function normalizeLegacyAssignee(v: string) {
  if (v === "nux") return "nux-core";
  if (v === "ivan") return "ivan";
  return v;
}

function loadTasks(): Task[] {
  if (typeof window === "undefined") return seedTasks();

  const rawV2 = window.localStorage.getItem(TASK_STORAGE_KEY);
  if (rawV2) {
    try {
      return JSON.parse(rawV2) as Task[];
    } catch {
      return seedTasks();
    }
  }

  const rawV1 = window.localStorage.getItem(LEGACY_KEY);
  if (!rawV1) return seedTasks();

  try {
    const parsed = JSON.parse(rawV1) as Array<Partial<Task> & { assignee?: string }>;
    return parsed.map((t) => ({
      id: t.id ?? cryptoRandomId(),
      title: t.title ?? "Untitled task",
      status: (t.status as Status) ?? "todo",
      assignee: normalizeLegacyAssignee(t.assignee ?? "nux-core"),
      createdAt: t.createdAt ?? t.updatedAt ?? nowIso(),
      updatedAt: t.updatedAt ?? nowIso(),
    }));
  } catch {
    return seedTasks();
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<string>("nux-core");
  const [query] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() ?? "";
  });

  useEffect(() => {
    if (!tasks.length) return;
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const grouped = useMemo(() => {
    const byStatus: Record<Status, Task[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const t of tasks) {
      if (query && !t.title.toLowerCase().includes(query)) continue;
      byStatus[t.status].push(t);
    }
    return byStatus;
  }, [tasks, query]);

  function addTask() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const n = nowIso();
    setTasks((prev) => [{ id: cryptoRandomId(), title: trimmed, assignee, status: "todo", createdAt: n, updatedAt: n }, ...prev]);
    setTitle("");
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t)));
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
            {ASSIGNEE_OPTIONS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button onClick={addTask} className="rounded-md bg-black px-4 py-2 text-sm text-white">Add</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(statusLabel) as Status[]).map((status) => (
          <section key={status} className="rounded-lg border bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{statusLabel[status]}</h2>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{grouped[status].length}</span>
            </div>

            <div className="space-y-2">
              {grouped[status].map((task) => (
                <article key={task.id} className="rounded-md border p-2">
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">assigned: {assigneeName(task.assignee)}</div>
                  <div className="mt-2 flex gap-2">
                    <select value={task.assignee} onChange={(e) => updateTask(task.id, { assignee: e.target.value })} className="rounded border px-2 py-1 text-xs">
                      {ASSIGNEE_OPTIONS.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <select value={task.status} onChange={(e) => updateTask(task.id, { status: e.target.value as Status })} className="rounded border px-2 py-1 text-xs">
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </article>
              ))}
              {grouped[status].length === 0 && <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No tasks</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
