"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { LEGACY_TEAM_MEMBERS } from "@/lib/team";

export default function OfficePage() {
  const tasks = useQuery(api.taskBoard.list, {});
  const teamMembers = useQuery(api.teamMembers.list, {});

  const members = teamMembers && teamMembers.length > 0 ? teamMembers : LEGACY_TEAM_MEMBERS;
  const board = useMemo(() => {
    const list = tasks ?? [];
    return {
      todo: list.filter((t) => t.status === "todo"),
      inProgress: list.filter((t) => t.status === "in_progress"),
      blocked: list.filter((t) => t.status === "blocked"),
      done: list.filter((t) => t.status === "done"),
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Office</h1>
        <p className="text-sm text-muted-foreground">Live team and execution snapshot.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Card title="Team" value={String(members.length)} sub="members" />
        <Card title="To Do" value={String(board.todo.length)} sub="open" />
        <Card title="In Progress" value={String(board.inProgress.length)} sub="active" />
        <Card title="Done" value={String(board.done.length)} sub="closed" />
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">Team roster</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border p-2 text-xs">
              <div className="font-medium">{m.name}</div>
              <div className="text-muted-foreground">{m.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">In-progress work</h2>
        <div className="mt-3 space-y-2">
          {board.inProgress.length === 0 ? (
            <div className="text-xs text-muted-foreground">No active tasks right now.</div>
          ) : (
            board.inProgress.map((t) => (
              <div key={t._id} className="rounded-lg border p-2 text-xs">
                <div className="font-medium">{t.title}</div>
                <div className="text-muted-foreground">assignee: {t.assignee}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
