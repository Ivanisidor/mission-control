"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Assignee = "ivan" | "nux";
type EventStatus = "planned" | "done" | "cancelled";
type ViewMode = "week" | "month";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [query] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q")?.trim().toLowerCase() ?? "";
  });
  const now = new Date();

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthGridDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));
  const monthGridEnd = addDays(monthGridStart, 42);

  const from = viewMode === "week" ? weekStart.getTime() : monthGridStart.getTime();
  const to = viewMode === "week" ? weekEnd.getTime() - 1 : monthGridEnd.getTime() - 1;

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState<Assignee>("nux");
  const [status, setStatus] = useState<EventStatus>("planned");
  const [startsAtLocal, setStartsAtLocal] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const tasks = useQuery(api.scheduledTasks.listUpcoming, { from, to, limit: 2000 });

  const createManual = useMutation(api.scheduledTasks.createManual);
  const updateManual = useMutation(api.scheduledTasks.updateManual);
  const removeManual = useMutation(api.scheduledTasks.removeManual);

  async function addManualEvent() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const startsAt = new Date(startsAtLocal).getTime();
    if (Number.isNaN(startsAt)) return;

    await createManual({
      name: trimmed,
      nextRunAt: startsAt,
      assignee,
      status,
    });
    setTitle("");
  }

  async function createCronFromManual(item: {
    _id: Id<"scheduledTasks">;
    name: string;
    nextRunAt: number;
    assignee?: string;
    notes?: string;
  }) {
    const res = await fetch("/api/cron/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        whenIso: new Date(item.nextRunAt).toISOString(),
        assignee: item.assignee,
        notes: item.notes,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      alert(`Failed to create cron: ${data.error ?? "unknown error"}`);
      return;
    }
    await updateManual({ id: item._id, promotedToCron: true });
    alert("Cron created and synced to calendar.");
  }

  const daysToRender = viewMode === "week" ? weekDays : monthGridDays;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Unified calendar for cron jobs and manually scheduled tasks (Convex-backed).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`rounded-md px-3 py-2 text-sm ${
              viewMode === "week" ? "bg-black text-white" : "border bg-white"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`rounded-md px-3 py-2 text-sm ${
              viewMode === "month" ? "bg-black text-white" : "border bg-white"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Add scheduled task</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="rounded-md border px-3 py-2 text-sm md:col-span-2"
          />
          <input
            type="datetime-local"
            value={startsAtLocal}
            onChange={(e) => setStartsAtLocal(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value as Assignee)}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="nux">Nux</option>
            <option value="ivan">Ivan</option>
          </select>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="planned">Planned</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={addManualEvent} className="rounded-md bg-black px-4 py-2 text-sm text-white">
              Add
            </button>
          </div>
        </div>
      </section>

      {!tasks ? (
        <div className="rounded-lg border bg-white p-4 text-sm">Loading calendar…</div>
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${viewMode === "week" ? "md:grid-cols-7" : "md:grid-cols-7"}`}>
          {daysToRender.map((day) => {
            const items = tasks.filter((it) => {
              if (!sameDay(new Date(it.nextRunAt), day)) return false;
              if (!query) return true;
              return it.name.toLowerCase().includes(query);
            });
            const inCurrentMonth = day.getMonth() === now.getMonth();
            return (
              <div
                key={day.toISOString()}
                className={`rounded-lg border bg-white ${
                  viewMode === "month" && !inCurrentMonth ? "opacity-50" : ""
                }`}
              >
                <div className="border-b p-3">
                  <div className="text-sm font-medium">{dayLabel(day)}</div>
                </div>
                <div className="space-y-2 p-3">
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No events</div>
                  ) : (
                    items.map((item) => {
                      const isManual = item.source === "manual" || item.scheduleKind === "manual";
                      return (
                        <article key={item._id} className="rounded-md border bg-zinc-50 p-2">
                          <div className="text-xs font-medium">{item.name}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(item.nextRunAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" · "}
                            {item.source ?? "cron"}
                            {" · "}
                            {item.assignee ?? "system"}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {item.scheduleKind}: {item.scheduleExpr}
                          </div>
                          {item.promotedToCron ? (
                            <div className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                              cron created
                            </div>
                          ) : null}

                          {isManual ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <select
                                value={(item.status as EventStatus | undefined) ?? "planned"}
                                onChange={(e) =>
                                  void updateManual({ id: item._id, status: e.target.value as EventStatus })
                                }
                                className="rounded border px-2 py-1 text-[11px]"
                              >
                                <option value="planned">planned</option>
                                <option value="done">done</option>
                                <option value="cancelled">cancelled</option>
                              </select>
                              <select
                                value={(item.assignee as Assignee | undefined) ?? "nux"}
                                onChange={(e) =>
                                  void updateManual({ id: item._id, assignee: e.target.value as Assignee })
                                }
                                className="rounded border px-2 py-1 text-[11px]"
                              >
                                <option value="nux">nux</option>
                                <option value="ivan">ivan</option>
                              </select>
                              <button
                                onClick={() => void createCronFromManual(item)}
                                disabled={Boolean(item.promotedToCron)}
                                className="rounded border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {item.promotedToCron ? "cron linked" : "create cron"}
                              </button>
                              <button
                                onClick={() => void removeManual({ id: item._id })}
                                className="rounded border px-2 py-1 text-[11px]"
                              >
                                delete
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
