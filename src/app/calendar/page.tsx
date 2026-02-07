"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function startOfWeek(d: Date) {
  // Monday start
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarPage() {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);

  const tasks = useQuery(api.scheduledTasks.listUpcoming, {
    from: weekStart.getTime(),
    to: weekEnd.getTime() - 1,
    limit: 500,
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Scheduled Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Weekly view of upcoming scheduled tasks (based on nextRunAt).
        </p>
      </div>

      {!tasks ? (
        <div className="rounded-lg border bg-white p-4 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((day) => {
            const items = tasks.filter((t) => sameDay(new Date(t.nextRunAt), day));
            return (
              <div key={day.toISOString()} className="rounded-lg border bg-white">
                <div className="border-b p-3">
                  <div className="text-sm font-medium">{fmtDay(day)}</div>
                </div>
                <div className="p-3">
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No tasks</div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((t) => (
                        <div key={t._id} className="rounded-md border bg-zinc-50 p-2">
                          <div className="text-xs font-medium">{t.name}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {t.scheduleKind}: {t.scheduleExpr}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            next: {new Date(t.nextRunAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
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
