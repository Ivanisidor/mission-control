"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WeeklySummaryPage() {
  const tasks = useQuery(api.taskBoard.list, {});
  const followUps = useQuery(api.followUpQueue.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const calendarTasks = useQuery(api.scheduledTasks.listUpcoming, {
    from: weekStart.getTime(),
    to: weekEnd.getTime() - 1,
    limit: 200,
  });

  type FollowUpRow = {
    _id: string;
    project: string;
    title: string;
    requestedBy: string;
    status: string;
  };

  type UpcomingEventRow = {
    _id: string;
    nextRunAt: number;
    name: string;
    assignee?: string;
  };

  let summary: {
    byProject: Map<
      string,
      {
        todo: number;
        inProgress: number;
        blocked: number;
        done: number;
        blockers: string[];
        owners: Set<string>;
        recentDone: string[];
      }
    >;
    pendingFollowUps: FollowUpRow[];
    resolvedThisWeek: FollowUpRow[];
    upcomingEvents: UpcomingEventRow[];
    teamCount: number;
  } | null = null;

  if (tasks && followUps && teamMembers) {
    const byProject = new Map<string, {
      todo: number;
      inProgress: number;
      blocked: number;
      done: number;
      blockers: string[];
      owners: Set<string>;
      recentDone: string[];
    }>();

    const weekStartMs = weekStart.getTime();

    for (const t of tasks) {
      const p = (t as { project?: string }).project || "unset";
      if (!byProject.has(p)) {
        byProject.set(p, { todo: 0, inProgress: 0, blocked: 0, done: 0, blockers: [], owners: new Set(), recentDone: [] });
      }
      const bucket = byProject.get(p)!;
      bucket.owners.add(t.assignee);
      if (t.status === "todo") bucket.todo++;
      else if (t.status === "in_progress") bucket.inProgress++;
      else if (t.status === "blocked") {
        bucket.blocked++;
        bucket.blockers.push(`${t.title} (${t.assignee})`);
      } else if (t.status === "done") {
        bucket.done++;
        if (t.updatedAt >= weekStartMs) {
          bucket.recentDone.push(t.title);
        }
      }
    }

    const pendingFollowUps = followUps.filter((f) => f.status === "pending") as unknown as FollowUpRow[];
    const resolvedThisWeek = followUps.filter(
      (f) => f.status !== "pending" && f.resolvedAt && f.resolvedAt >= weekStartMs,
    ) as unknown as FollowUpRow[];

    const upcomingEvents = ((calendarTasks ?? []).slice(0, 10)) as unknown as UpcomingEventRow[];

    summary = { byProject, pendingFollowUps, resolvedThisWeek, upcomingEvents, teamCount: teamMembers.length };
  }

  if (!summary) {
    return <div className="p-6 text-sm text-muted-foreground">Loading summary…</div>;
  }

  const weekLabel = `${fmtDate(weekStart.getTime())} – ${fmtDate(weekEnd.getTime() - 1)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Summary</h1>
        <p className="text-sm text-muted-foreground">
          Project continuity report · {weekLabel} · {summary.teamCount} team members
        </p>
      </div>

      {[...summary.byProject.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([project, data]) => (
        <section key={project} className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">{project}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            Owners: {[...data.owners].join(", ")}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded bg-zinc-100 p-2">
              <div className="text-lg font-semibold">{data.todo}</div>
              <div className="text-muted-foreground">To Do</div>
            </div>
            <div className="rounded bg-blue-50 p-2">
              <div className="text-lg font-semibold">{data.inProgress}</div>
              <div className="text-muted-foreground">Active</div>
            </div>
            <div className="rounded bg-rose-50 p-2">
              <div className="text-lg font-semibold">{data.blocked}</div>
              <div className="text-muted-foreground">Blocked</div>
            </div>
            <div className="rounded bg-emerald-50 p-2">
              <div className="text-lg font-semibold">{data.done}</div>
              <div className="text-muted-foreground">Done</div>
            </div>
          </div>

          {data.blockers.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-rose-600">⚠ Blockers</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-rose-700">
                {data.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}

          {data.recentDone.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-emerald-600">✓ Completed this week</div>
              <ul className="mt-1 list-disc pl-4 text-xs text-emerald-700">
                {data.recentDone.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          )}
        </section>
      ))}

      {summary.pendingFollowUps.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Pending Follow-Ups ({summary.pendingFollowUps.length})</h2>
          <ul className="mt-2 space-y-1">
            {summary.pendingFollowUps.map((f) => (
              <li key={f._id} className="text-xs text-amber-700">
                <span className="font-medium">[{f.project}]</span> {f.title} — requested by {f.requestedBy}
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.resolvedThisWeek.length > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Follow-Ups Resolved This Week ({summary.resolvedThisWeek.length})</h2>
          <ul className="mt-2 space-y-1">
            {summary.resolvedThisWeek.map((f) => (
              <li key={f._id} className="text-xs">
                <span className={f.status === "approved" ? "text-emerald-600" : f.status === "rejected" ? "text-rose-600" : "text-zinc-500"}>
                  [{f.status}]
                </span>{" "}
                <span className="font-medium">[{f.project}]</span> {f.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(summary.upcomingEvents.length > 0) && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold">Upcoming This Week</h2>
          <ul className="mt-2 space-y-1">
            {summary.upcomingEvents.map((e) => (
              <li key={e._id} className="text-xs">
                <span className="font-medium">{fmtDate(e.nextRunAt)}</span> — {e.name}
                <span className="text-muted-foreground"> · {e.assignee ?? "system"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
