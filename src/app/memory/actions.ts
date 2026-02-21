"use server";

import { promises as fs } from "node:fs";
import path from "node:path";

export type MemoryTag = "decision" | "todo" | "preference" | "infra";

export type MemoryLink = {
  kind: "task" | "calendar";
  target: string;
};

export type MemoryDoc = {
  file: string;
  title: string;
  updatedAt: number;
  snippet: string;
  content: string;
  kind: "long_term" | "daily";
  tags: MemoryTag[];
  links: MemoryLink[];
  matches: Array<{ line: number; text: string }>;
};

export type MemorySnapshot = {
  id: string;
  file: string;
  createdAt: number;
  content: string;
};

const ROOT = "/home/ivan/clawd";
const MEMORY_DIR = path.join(ROOT, "memory");
const PRIMARY_FILES = [path.join(ROOT, "MEMORY.md")];
const SNAPSHOT_DIR = path.join(MEMORY_DIR, ".snapshots");

function fileTitle(filePath: string) {
  const base = path.basename(filePath);
  if (base === "MEMORY.md") return "Long-term Memory";
  return base.replace(/\.md$/i, "");
}

function normalizeForSearch(text: string) {
  return text.toLowerCase();
}

function topSnippet(content: string, term: string) {
  const lines = content.split(/\r?\n/);
  if (!term) return lines.slice(0, 10).join("\n").trim();

  const q = normalizeForSearch(term);
  const idx = lines.findIndex((l) => normalizeForSearch(l).includes(q));
  if (idx === -1) return lines.slice(0, 10).join("\n").trim();

  const start = Math.max(0, idx - 2);
  const end = Math.min(lines.length, idx + 3);
  return lines.slice(start, end).join("\n").trim();
}

function findMatches(content: string, term: string) {
  if (!term) return [];
  const q = normalizeForSearch(term);
  const lines = content.split(/\r?\n/);
  const hits: Array<{ line: number; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (normalizeForSearch(lines[i]).includes(q)) {
      hits.push({ line: i + 1, text: lines[i].trim() });
      if (hits.length >= 5) break;
    }
  }
  return hits;
}

function getKind(filePath: string): "long_term" | "daily" {
  return path.basename(filePath) === "MEMORY.md" ? "long_term" : "daily";
}

function detectTags(content: string): MemoryTag[] {
  const lc = content.toLowerCase();
  const tags: MemoryTag[] = [];
  if (/\b(decision|decided|chose|approved)\b/.test(lc)) tags.push("decision");
  if (/\b(todo|follow-up|follow up|next step|next steps|pending)\b/.test(lc)) tags.push("todo");
  if (/\b(prefer|preference|likes|dislikes|style)\b/.test(lc)) tags.push("preference");
  if (/\b(infra|server|docker|wsl|gateway|cron|deploy|systemd|ollama)\b/.test(lc)) tags.push("infra");
  return tags;
}

function detectLinks(content: string): MemoryLink[] {
  const links: MemoryLink[] = [];
  const taskMatches = [...content.matchAll(/\[\[task:(.+?)\]\]/gi)];
  const calendarMatches = [...content.matchAll(/\[\[calendar:(.+?)\]\]/gi)];

  for (const m of taskMatches) links.push({ kind: "task", target: (m[1] ?? "").trim() });
  for (const m of calendarMatches) links.push({ kind: "calendar", target: (m[1] ?? "").trim() });

  return links;
}

function isAllowedMemoryPath(relPath: string) {
  if (relPath === "MEMORY.md") return true;
  return /^memory\/[\w.-]+\.md$/i.test(relPath);
}

function snapshotFilePath(file: string) {
  const safe = file.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return path.join(SNAPSHOT_DIR, `${safe}.json`);
}

async function readSnapshots(file: string): Promise<MemorySnapshot[]> {
  try {
    const raw = await fs.readFile(snapshotFilePath(file), "utf8");
    return JSON.parse(raw) as MemorySnapshot[];
  } catch {
    return [];
  }
}

async function writeSnapshots(file: string, snapshots: MemorySnapshot[]) {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.writeFile(snapshotFilePath(file), JSON.stringify(snapshots, null, 2), "utf8");
}

export async function listSnapshots(file: string): Promise<MemorySnapshot[]> {
  if (!isAllowedMemoryPath(file)) return [];
  const rows = await readSnapshots(file);
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createSnapshot(file: string, content?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isAllowedMemoryPath(file)) return { ok: false, error: "Unsupported file path" };
  const abs = path.join(ROOT, file);

  try {
    const current = content ?? (await fs.readFile(abs, "utf8"));
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rows = await readSnapshots(file);
    rows.unshift({ id, file, createdAt: Date.now(), content: current });
    await writeSnapshots(file, rows.slice(0, 50));
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Snapshot failed" };
  }
}

export async function restoreSnapshot(file: string, snapshotId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isAllowedMemoryPath(file)) return { ok: false, error: "Unsupported file path" };
  const rows = await readSnapshots(file);
  const snap = rows.find((s) => s.id === snapshotId);
  if (!snap) return { ok: false, error: "Snapshot not found" };

  try {
    await fs.writeFile(path.join(ROOT, file), snap.content, "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Restore failed" };
  }
}

export async function diffMemoryDoc(file: string, newContent: string): Promise<{ added: string[]; removed: string[]; changed: boolean }> {
  if (!isAllowedMemoryPath(file)) return { added: [], removed: [], changed: false };

  try {
    const oldContent = await fs.readFile(path.join(ROOT, file), "utf8");
    const oldLines = oldContent.split(/\r?\n/);
    const newLines = newContent.split(/\r?\n/);

    const removed = oldLines.filter((l) => !newLines.includes(l)).slice(0, 80);
    const added = newLines.filter((l) => !oldLines.includes(l)).slice(0, 80);
    return { added, removed, changed: added.length > 0 || removed.length > 0 };
  } catch {
    return { added: [], removed: [], changed: false };
  }
}

export async function updateMemoryDoc(file: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const rel = file.trim();
  if (!isAllowedMemoryPath(rel)) {
    return { ok: false, error: "Unsupported file path" };
  }

  const abs = path.join(ROOT, rel);
  try {
    await createSnapshot(rel);
    await fs.writeFile(abs, content, "utf8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Write failed" };
  }
}

export async function listMemoryDocs(term?: string): Promise<MemoryDoc[]> {
  const query = (term ?? "").trim();

  const memoryDirFiles = await fs
    .readdir(MEMORY_DIR, { withFileTypes: true })
    .then((entries) =>
      entries
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => path.join(MEMORY_DIR, e.name)),
    )
    .catch(() => [] as string[]);

  const allFiles = [...PRIMARY_FILES, ...memoryDirFiles];
  const docs: MemoryDoc[] = [];

  for (const filePath of allFiles) {
    try {
      const [stat, raw] = await Promise.all([fs.stat(filePath), fs.readFile(filePath, "utf8")]);
      const matches = findMatches(raw, query);

      if (query && matches.length === 0) continue;

      docs.push({
        file: filePath.replace(`${ROOT}/`, ""),
        title: fileTitle(filePath),
        updatedAt: stat.mtimeMs,
        snippet: topSnippet(raw, query),
        content: raw,
        kind: getKind(filePath),
        tags: detectTags(raw),
        links: detectLinks(raw),
        matches,
      });
    } catch {
      // ignore unreadable files
    }
  }

  docs.sort((a, b) => b.updatedAt - a.updatedAt);
  return docs;
}
