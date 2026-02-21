"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TASK_STORAGE_KEY, type Task } from "@/lib/taskBoard";
import {
  createSnapshot,
  diffMemoryDoc,
  listMemoryDocs,
  listSnapshots,
  restoreSnapshot,
  updateMemoryDoc,
  type MemoryDoc,
  type MemorySnapshot,
  type MemoryTag,
} from "./actions";

type KindFilter = "all" | "long_term" | "daily";
type DateFilter = "all" | "7d" | "30d";
type TagFilter = "all" | MemoryTag;

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString();
}

function withinDateRange(ts: number, range: DateFilter) {
  if (range === "all") return true;
  const days = range === "7d" ? 7 : 30;
  return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function suggestionLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4)
    .filter((l) => /\b(todo|follow-up|follow up|next step|next steps|action item|pending)\b/i.test(l))
    .slice(0, 10);
}

export default function MemoryPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [docs, setDocs] = useState<MemoryDoc[] | null>([]);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [selectedDoc, setSelectedDoc] = useState<MemoryDoc | null>(null);
  const [editorText, setEditorText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [snapshots, setSnapshots] = useState<MemorySnapshot[]>([]);
  const [diff, setDiff] = useState<{ added: string[]; removed: string[]; changed: boolean } | null>(null);
  const [linkKind, setLinkKind] = useState<"task" | "calendar">("task");
  const [linkTarget, setLinkTarget] = useState("");
  const [taskOptions, setTaskOptions] = useState<Task[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(TASK_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Task[]) : [];
    } catch {
      return [];
    }
  });
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [timeWindow] = useState(() => {
    const now = Date.now();
    return {
      from: now - 30 * 24 * 60 * 60 * 1000,
      to: now + 365 * 24 * 60 * 60 * 1000,
    };
  });

  const calendarOptions = useQuery(api.scheduledTasks.listUpcoming, {
    from: timeWindow.from,
    to: timeWindow.to,
    limit: 500,
  });
  const createManual = useMutation(api.scheduledTasks.createManual);

  async function refreshDocs(query = submitted) {
    const res = await listMemoryDocs(query);
    setDocs(res);
    return res;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = term.trim();
    setSubmitted(q);
    await refreshDocs(q);
  }

  function insertCrossLink() {
    const target = linkTarget.trim();
    if (!target) return;
    const token = `[[${linkKind}:${target}]]`;

    const el = editorRef.current;
    if (!el) {
      setEditorText((prev) => `${prev}${prev.endsWith("\n") ? "" : "\n"}${token}`);
      return;
    }

    const start = el.selectionStart ?? editorText.length;
    const end = el.selectionEnd ?? editorText.length;
    const next = `${editorText.slice(0, start)}${token}${editorText.slice(end)}`;
    setEditorText(next);
    setLinkTarget("");

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function openDoc(doc: MemoryDoc) {
    setSelectedDoc(doc);
    setEditorText(doc.content);
    setDiff(null);
    setLinkTarget("");
    const snaps = await listSnapshots(doc.file);
    setSnapshots(snaps);
  }

  async function saveSelectedDoc() {
    if (!selectedDoc) return;
    setIsSaving(true);
    const result = await updateMemoryDoc(selectedDoc.file, editorText);
    setIsSaving(false);

    if (!result.ok) {
      alert(`Save failed: ${result.error ?? "unknown error"}`);
      return;
    }

    const refreshed = await refreshDocs();
    const updated = refreshed.find((d) => d.file === selectedDoc.file) ?? null;
    setSelectedDoc(updated);
    if (updated) {
      setEditorText(updated.content);
      setSnapshots(await listSnapshots(updated.file));
      setDiff(null);
    }
  }

  async function previewDiff() {
    if (!selectedDoc) return;
    const d = await diffMemoryDoc(selectedDoc.file, editorText);
    setDiff(d);
  }

  async function snapshotNow() {
    if (!selectedDoc) return;
    await createSnapshot(selectedDoc.file, editorText);
    setSnapshots(await listSnapshots(selectedDoc.file));
  }

  async function restore(snapshotId: string) {
    if (!selectedDoc) return;
    const res = await restoreSnapshot(selectedDoc.file, snapshotId);
    if (!res.ok) {
      alert(`Restore failed: ${res.error ?? "unknown error"}`);
      return;
    }
    const refreshed = await refreshDocs();
    const updated = refreshed.find((d) => d.file === selectedDoc.file) ?? null;
    setSelectedDoc(updated);
    if (updated) {
      setEditorText(updated.content);
      setSnapshots(await listSnapshots(updated.file));
      setDiff(null);
    }
  }

  function addTaskFromSuggestion(text: string) {
    const nowIso = new Date().toISOString();
    const next: Task[] = [
      {
        id: cryptoRandomId(),
        title: text,
        status: "todo",
        assignee: "nux-core",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...taskOptions,
    ];
    setTaskOptions(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(next));
    }
  }

  async function addCalendarFromSuggestion(text: string) {
    await createManual({
      name: text,
      nextRunAt: Date.now() + 24 * 60 * 60 * 1000,
      assignee: "nux",
      status: "planned",
    });
  }

  const filteredDocs = useMemo(() => {
    if (!docs) return null;
    return docs.filter((d) => {
      const kindOk = kindFilter === "all" || d.kind === kindFilter;
      const dateOk = withinDateRange(d.updatedAt, dateFilter);
      const tagOk = tagFilter === "all" || d.tags.includes(tagFilter);
      return kindOk && dateOk && tagOk;
    });
  }, [docs, kindFilter, dateFilter, tagFilter]);

  const suggestions = useMemo(() => suggestionLines(editorText), [editorText]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Memory Library</h1>
        <p className="text-sm text-muted-foreground">
          Browse long-term + daily memory notes, tags, links, snapshots, and restore history.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search memories…" className="flex-1 rounded-md border bg-white px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white">Search</button>
      </form>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">All memory types</option>
          <option value="long_term">Long-term only</option>
          <option value="daily">Daily notes only</option>
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">All dates</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value as TagFilter)} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">All tags</option>
          <option value="decision">decision</option>
          <option value="todo">todo</option>
          <option value="preference">preference</option>
          <option value="infra">infra</option>
        </select>
      </div>

      {filteredDocs === null ? (
        <div className="rounded-lg border bg-white p-4 text-sm">Loading memories…</div>
      ) : filteredDocs.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground">No memory documents matched.</div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map((doc) => (
            <article key={doc.file} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">{doc.title}</h2>
                  <div className="text-xs text-muted-foreground">{doc.file}</div>
                </div>
                <div className="text-xs text-muted-foreground">Updated {fmtDate(doc.updatedAt)}</div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {doc.tags.map((t) => (
                  <span key={t} className="rounded bg-zinc-100 px-2 py-1 text-[11px]">{t}</span>
                ))}
                {doc.links.map((l, i) => (
                  <button
                    key={`${l.kind}-${i}`}
                    onClick={() => {
                      const q = encodeURIComponent(l.target);
                      window.location.href = l.kind === "task" ? `/tasks?q=${q}` : `/calendar?q=${q}`;
                    }}
                    className="rounded bg-amber-100 px-2 py-1 text-[11px] hover:bg-amber-200"
                  >
                    {l.kind}: {l.target}
                  </button>
                ))}
              </div>

              <pre className="mt-3 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs whitespace-pre-wrap">{doc.snippet || "(empty file)"}</pre>
              <div className="mt-3">
                <button onClick={() => void openDoc(doc)} className="rounded-md border bg-white px-3 py-1.5 text-xs">Open full document</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{selectedDoc.title}</div>
                <div className="text-xs text-muted-foreground">{selectedDoc.file}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void previewDiff()} className="rounded-md border px-3 py-1 text-xs">Preview diff</button>
                <button onClick={() => void snapshotNow()} className="rounded-md border px-3 py-1 text-xs">Snapshot now</button>
                <button onClick={() => void saveSelectedDoc()} disabled={isSaving} className="rounded-md bg-black px-3 py-1 text-xs text-white disabled:opacity-50">{isSaving ? "Saving…" : "Save"}</button>
                <button onClick={() => setSelectedDoc(null)} className="rounded-md border px-3 py-1 text-xs">Close</button>
              </div>
            </div>
            <div className="grid max-h-[75vh] grid-cols-1 gap-3 overflow-auto p-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-2">
                <div className="rounded-lg border bg-white p-2">
                  <div className="mb-2 text-xs font-semibold">Insert cross-link</div>
                  <div className="flex flex-wrap gap-2">
                    <select value={linkKind} onChange={(e) => setLinkKind(e.target.value as "task" | "calendar")} className="rounded border px-2 py-1 text-xs">
                      <option value="task">task</option>
                      <option value="calendar">calendar</option>
                    </select>

                    {linkKind === "task" ? (
                      <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className="min-w-[280px] flex-1 rounded border px-2 py-1 text-xs">
                        <option value="">Select task…</option>
                        {taskOptions.map((t) => (
                          <option key={t.id} value={t.title}>{t.title}</option>
                        ))}
                      </select>
                    ) : (
                      <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className="min-w-[280px] flex-1 rounded border px-2 py-1 text-xs">
                        <option value="">Select calendar item…</option>
                        {(calendarOptions ?? []).map((c) => (
                          <option key={c._id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    )}

                    <button onClick={insertCrossLink} className="rounded border px-2 py-1 text-xs">insert [[link]]</button>
                  </div>
                </div>

                <textarea ref={editorRef} value={editorText} onChange={(e) => setEditorText(e.target.value)} className="min-h-[60vh] w-full rounded-lg border bg-zinc-50 p-4 font-mono text-xs" />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold">Action suggestions</div>
                  <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                    {suggestions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No todo/follow-up lines detected.</div>
                    ) : (
                      suggestions.map((s, i) => (
                        <div key={`${s}-${i}`} className="rounded border p-2 text-[11px]">
                          <div className="mb-1">{s}</div>
                          <div className="flex gap-1">
                            <button onClick={() => addTaskFromSuggestion(s)} className="rounded border px-2 py-0.5">+ task</button>
                            <button onClick={() => void addCalendarFromSuggestion(s)} className="rounded border px-2 py-0.5">+ calendar</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold">Snapshots</div>
                  <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                    {snapshots.length === 0 ? <div className="text-xs text-muted-foreground">No snapshots yet.</div> : snapshots.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 rounded border p-2 text-[11px]">
                        <span>{fmtDate(s.createdAt)}</span>
                        <button onClick={() => void restore(s.id)} className="rounded border px-2 py-0.5">restore</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold">Diff preview</div>
                  {!diff ? <div className="mt-2 text-xs text-muted-foreground">Click “Preview diff”.</div> : !diff.changed ? <div className="mt-2 text-xs text-muted-foreground">No changes detected.</div> : (
                    <div className="mt-2 space-y-2 text-xs">
                      <div>
                        <div className="font-medium text-emerald-700">Added</div>
                        <ul className="list-disc pl-4">{diff.added.slice(0, 20).map((l, i) => <li key={`a-${i}`} className="text-emerald-700">{l || "(blank)"}</li>)}</ul>
                      </div>
                      <div>
                        <div className="font-medium text-rose-700">Removed</div>
                        <ul className="list-disc pl-4">{diff.removed.slice(0, 20).map((l, i) => <li key={`r-${i}`} className="text-rose-700">{l || "(blank)"}</li>)}</ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
