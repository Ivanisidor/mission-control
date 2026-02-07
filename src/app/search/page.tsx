"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { searchWorkspace, type FileMatch } from "./actions";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [fileMatches, setFileMatches] = useState<FileMatch[] | null>(null);

  const convexResults = useQuery(
    api.search.searchAll,
    submitted ? { term: submitted, limit: 20 } : "skip"
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = term.trim();
    setSubmitted(q);
    setFileMatches(null);
    if (q) {
      const matches = await searchWorkspace(q);
      setFileMatches(matches);
    } else {
      setFileMatches([]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Global Search</h1>
        <p className="text-sm text-muted-foreground">
          Search Convex (activity/scheduled tasks) + workspace docs (MEMORY.md, memory/*.md, TODO.md, README.md).
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="flex-1 rounded-md border bg-white px-3 py-2 text-sm"
          placeholder="Search term…"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Search
        </button>
      </form>

      {submitted ? (
        <div className="space-y-4">
          <section className="rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold">Convex</div>
            {!convexResults ? (
              <div className="mt-2 text-sm">Loading…</div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Activity Events
                  </div>
                  <div className="mt-2 space-y-2">
                    {convexResults.activityEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No matches</div>
                    ) : (
                      convexResults.activityEvents.map((e) => (
                        <div key={e._id} className="rounded-md border bg-zinc-50 p-2">
                          <div className="text-xs font-medium">{e.summary}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {e.type} · {new Date(e.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground">
                    Scheduled Tasks
                  </div>
                  <div className="mt-2 space-y-2">
                    {convexResults.scheduledTasks.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No matches</div>
                    ) : (
                      convexResults.scheduledTasks.map((t) => (
                        <div key={t._id} className="rounded-md border bg-zinc-50 p-2">
                          <div className="text-xs font-medium">{t.name}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {t.scheduleKind}: {t.scheduleExpr}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            next: {new Date(t.nextRunAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold">Workspace files</div>
            {fileMatches === null ? (
              <div className="mt-2 text-sm">Searching…</div>
            ) : fileMatches.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">No matches</div>
            ) : (
              <div className="mt-3 space-y-2">
                {fileMatches.map((m, idx) => (
                  <div key={idx} className="rounded-md border bg-zinc-50 p-2">
                    <div className="text-[11px] text-muted-foreground">
                      {m.file}:{m.line}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-xs">{m.text}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Enter a term to search.</div>
      )}
    </div>
  );
}
