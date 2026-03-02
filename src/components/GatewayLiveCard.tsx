"use client";

import { useGatewayLive } from "@/lib/useGatewayLive";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

export default function GatewayLiveCard() {
  const state = useGatewayLive();

  const badgeClass =
    state.status === "online"
      ? "bg-emerald-100 text-emerald-700"
      : state.status === "offline"
        ? "bg-rose-100 text-rose-700"
        : "bg-zinc-100 text-zinc-700";

  return (
    <section className="rounded-lg border bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">OpenClaw Gateway</h2>
        <span className={`rounded px-2 py-0.5 text-xs ${badgeClass}`}>{state.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">Transport: {state.transport}. Last update: {fmt(state.updatedAt)}</p>
      {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
      {state.payload ? (
        <pre className="max-h-48 overflow-auto rounded border bg-zinc-50 p-2 text-[11px]">{JSON.stringify(state.payload, null, 2)}</pre>
      ) : (
        <p className="text-xs text-muted-foreground">Waiting for gateway updates.</p>
      )}
    </section>
  );
}
