#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);
const outDir = process.env.BACKUP_DIR || "./backups";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

await fs.mkdir(outDir, { recursive: true });
const outPath = `${outDir}/convex-${stamp}.zip`;

await execFileAsync("npx", ["convex", "export", "--path", outPath], { timeout: 120_000 });
console.log(`Backup complete: ${outPath}`);
