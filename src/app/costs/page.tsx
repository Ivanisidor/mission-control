"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const PRICE_PER_MILLION: Record<string, { in: number; out: number }> = {
  "openai-codex/gpt-5.3-codex": { in: 15, out: 60 },
  "openai/gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "google-vertex/gemini-3-flash-preview": { in: 0.35, out: 1.05 },
  "ollama/qwen2.5-coder-14b": { in: 0, out: 0 },
};

function estimateUsd(model: string | undefined, tokensIn: number, tokensOut: number) {
  const p = model ? PRICE_PER_MILLION[model] : undefined;
  if (!p) return 0;
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

export default function CostsPage() {
  const runs = useQuery(api.runs.list, { limit: 1000 });
  const agents = useQuery(api.agents.list, { enabledOnly: false });

  const byModel = useMemo(() => {
    const rows = new Map<string, { model: string; runs: number; in: number; out: number; total: number; usd: number }>();
    for (const r of runs ?? []) {
      const model = r.model ?? "(unknown)";
      const rec = rows.get(model) ?? { model, runs: 0, in: 0, out: 0, total: 0, usd: 0 };
      rec.runs += 1;
      rec.in += r.tokensIn ?? 0;
      rec.out += r.tokensOut ?? 0;
      rec.total += r.tokensTotal ?? (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
      rec.usd += estimateUsd(r.model, r.tokensIn ?? 0, r.tokensOut ?? 0);
      rows.set(model, rec);
    }
    return [...rows.values()].sort((a, b) => b.usd - a.usd || b.total - a.total);
  }, [runs]);

  const byAgent = useMemo(() => {
    const names = new Map((agents ?? []).map((a) => [a._id, a.name]));
    const rows = new Map<string, { agent: string; runs: number; tokens: number; usd: number }>();

    for (const r of runs ?? []) {
      const agent = names.get(r.agentId) ?? r.agentId;
      const rec = rows.get(agent) ?? { agent, runs: 0, tokens: 0, usd: 0 };
      rec.runs += 1;
      rec.tokens += r.tokensTotal ?? (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
      rec.usd += estimateUsd(r.model, r.tokensIn ?? 0, r.tokensOut ?? 0);
      rows.set(agent, rec);
    }

    return [...rows.values()].sort((a, b) => b.usd - a.usd || b.tokens - a.tokens);
  }, [agents, runs]);

  const totals = useMemo(() => {
    return (runs ?? []).reduce(
      (acc, r) => {
        acc.runs += 1;
        acc.in += r.tokensIn ?? 0;
        acc.out += r.tokensOut ?? 0;
        acc.total += r.tokensTotal ?? (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
        acc.usd += estimateUsd(r.model, r.tokensIn ?? 0, r.tokensOut ?? 0);
        return acc;
      },
      { runs: 0, in: 0, out: 0, total: 0, usd: 0 },
    );
  }, [runs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Model Cost Board</h1>
        <p className="text-sm text-muted-foreground">Estimated token cost breakdown by model and agent from Mission Control runs.</p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Runs" value={totals.runs.toLocaleString()} />
        <Stat label="Input tokens" value={totals.in.toLocaleString()} />
        <Stat label="Output tokens" value={totals.out.toLocaleString()} />
        <Stat label="Estimated USD" value={`$${totals.usd.toFixed(4)}`} />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">By model</h2>
        <div className="space-y-2 text-sm">
          {byModel.map((row) => (
            <div key={row.model} className="grid grid-cols-1 gap-1 rounded border p-2 md:grid-cols-6">
              <div className="font-medium md:col-span-2">{row.model}</div>
              <div>runs: {row.runs}</div>
              <div>tokens: {row.total.toLocaleString()}</div>
              <div>in/out: {row.in.toLocaleString()} / {row.out.toLocaleString()}</div>
              <div className="font-semibold">${row.usd.toFixed(4)}</div>
            </div>
          ))}
          {byModel.length === 0 && <p className="text-xs text-muted-foreground">No run data yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">By agent</h2>
        <div className="space-y-2 text-sm">
          {byAgent.map((row) => (
            <div key={row.agent} className="grid grid-cols-1 gap-1 rounded border p-2 md:grid-cols-4">
              <div className="font-medium">{row.agent}</div>
              <div>runs: {row.runs}</div>
              <div>tokens: {row.tokens.toLocaleString()}</div>
              <div className="font-semibold">${row.usd.toFixed(4)}</div>
            </div>
          ))}
          {byAgent.length === 0 && <p className="text-xs text-muted-foreground">No run data yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
