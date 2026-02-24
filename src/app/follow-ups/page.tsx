"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LEGACY_TEAM_MEMBERS, type TeamMember } from "@/lib/team";

type QueueStatus = "pending" | "approved" | "rejected" | "deferred";

const statusStyle: Record<QueueStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  deferred: "bg-zinc-200 text-zinc-600",
};

export default function FollowUpsPage() {
  const items = useQuery(api.followUpQueue.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});
  const createItem = useMutation(api.followUpQueue.create);
  const resolveItem = useMutation(api.followUpQueue.resolve);

  const members = (teamMembers && teamMembers.length > 0 ? teamMembers : LEGACY_TEAM_MEMBERS) as TeamMember[];
  const ownerOptions = useMemo(
    () => [{ id: "ivan", name: "Ivan" }, ...members.map((m) => ({ id: m.id, name: m.name }))],
    [members],
  );

  const [filter, setFilter] = useState<"all" | QueueStatus>("pending");
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionOwner, setActionOwner] = useState("ivan");
  const [requestedBy, setRequestedBy] = useState("cris");
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const projects = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map((i) => i.project))].sort();
  }, [items]);

  async function addItem() {
    const t = title.trim();
    const p = project.trim();
    const d = description.trim();
    if (!t || !p) return;
    await createItem({ project: p, title: t, description: d || t, actionOwner, requestedBy });
    setTitle("");
    setDescription("");
  }

  async function resolve(id: Id<"followUpQueue">, status: QueueStatus) {
    await resolveItem({ id, status, ivanNote: noteMap[id] || undefined });
    setNoteMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const pendingCount = items?.filter((i) => i.status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Follow-Up Queue</h1>
        <p className="text-sm text-muted-foreground">
          Cross-project items awaiting Ivan&apos;s approval or decision.
          {pendingCount > 0 && (
            <span className="ml-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Submit follow-up</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project (e.g. led-beacon)" className="rounded-md border px-3 py-2 text-sm" list="project-suggestions" />
          <datalist id="project-suggestions">
            {projects.map((p) => <option key={p} value={p} />)}
          </datalist>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="What needs approval?" className="rounded-md border px-3 py-2 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details / context (optional)" className="rounded-md border px-3 py-2 text-sm md:col-span-2" rows={2} />
          <select value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button onClick={addItem} className="mt-3 rounded-md bg-black px-4 py-2 text-sm text-white">Submit</button>
      </section>

      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "deferred", "all"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-md px-3 py-2 text-sm ${filter === s ? "bg-black text-white" : "border bg-white"}`}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {!items ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {filter === "pending" ? "No pending follow-ups. 🎉" : "No items match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article key={item._id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.project} · owner: {item.actionOwner} · from: {item.requestedBy}
                    {item.deadline && ` · due: ${new Date(item.deadline).toLocaleDateString()}`}
                  </div>
                  {item.description !== item.title && (
                    <div className="mt-2 text-xs text-zinc-600">{item.description}</div>
                  )}
                </div>
                <span className={`shrink-0 rounded px-2 py-1 text-[11px] font-medium ${statusStyle[item.status as QueueStatus]}`}>
                  {item.status}
                </span>
              </div>

              {item.ivanNote && (
                <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-800">
                  <span className="font-medium">Ivan:</span> {item.ivanNote}
                </div>
              )}

              {item.status === "pending" && (
                <div className="mt-3 space-y-2">
                  <input
                    value={noteMap[item._id] ?? ""}
                    onChange={(e) => setNoteMap((prev) => ({ ...prev, [item._id]: e.target.value }))}
                    placeholder="Add a note (optional)"
                    className="w-full rounded border px-2 py-1 text-xs"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => void resolve(item._id, "approved")} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Approve</button>
                    <button onClick={() => void resolve(item._id, "rejected")} className="rounded bg-rose-600 px-3 py-1 text-xs text-white">Reject</button>
                    <button onClick={() => void resolve(item._id, "deferred")} className="rounded border px-3 py-1 text-xs">Defer</button>
                  </div>
                </div>
              )}

              {item.resolvedAt && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Resolved: {new Date(item.resolvedAt).toLocaleString()}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
