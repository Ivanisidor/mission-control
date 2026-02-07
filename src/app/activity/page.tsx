"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function formatTs(ms: number) {
  return new Date(ms).toLocaleString();
}

export default function ActivityPage() {
  const events = useQuery(api.activityEvents.list, { limit: 200 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Activity Feed</h1>
        <p className="text-sm text-muted-foreground">
          Every action/task recorded here (newest first).
        </p>
      </div>

      {!events ? (
        <div className="rounded-lg border bg-white p-4 text-sm">Loading…</div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm">
          No activity yet.
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e._id} className="rounded-lg border bg-white p-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-sm font-medium">{e.summary}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTs(e.createdAt)}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{e.type}</div>
              {e.details ? (
                <pre className="mt-3 overflow-auto rounded-md bg-zinc-50 p-3 text-xs">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
