"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ExecError = Error & { code?: number | string };

export type FileMatch = {
  file: string;
  line: number;
  text: string;
};

function parseMatches(stdout: string): FileMatch[] {
  const lines = stdout.split("\n").filter(Boolean);
  return lines.slice(0, 50).map((line) => {
    const first = line.indexOf(":");
    const second = line.indexOf(":", first + 1);
    const file = line.slice(0, first);
    const lineNo = Number(line.slice(first + 1, second));
    const text = line.slice(second + 1);
    return { file, line: lineNo, text };
  });
}

export async function searchWorkspace(term: string): Promise<FileMatch[]> {
  const q = term.trim();
  if (!q) return [];

  const paths = [
    "/home/ivan/clawd/MEMORY.md",
    "/home/ivan/clawd/TODO.md",
    "/home/ivan/clawd/README.md",
    "/home/ivan/clawd/memory",
  ];

  const args = [
    "-n",
    "-H",
    "--no-heading",
    "--color",
    "never",
    "--max-count",
    "50",
    "--glob",
    "memory/*.md",
    q,
    ...paths,
  ];

  try {
    const { stdout } = await execFileAsync("rg", args, {
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });
    return parseMatches(stdout);
  } catch (error) {
    const err = error as ExecError;
    if (typeof err.code === "number" && err.code === 1) return [];

    if (err.code === "ENOENT" || /not found/i.test(err.message || "")) {
      try {
        const grepArgs = [
          "-RIn",
          "--",
          q,
          "/home/ivan/clawd/MEMORY.md",
          "/home/ivan/clawd/TODO.md",
          "/home/ivan/clawd/README.md",
          "/home/ivan/clawd/memory",
        ];
        const { stdout } = await execFileAsync("grep", grepArgs, {
          timeout: 5_000,
          maxBuffer: 1024 * 1024,
        });
        return parseMatches(stdout);
      } catch (fallbackError) {
        const fallback = fallbackError as ExecError;
        if (typeof fallback.code === "number" && fallback.code === 1) return [];
        return [{ file: "(search)", line: 0, text: `Search error: ${fallback.message || String(fallback)}` }];
      }
    }

    return [{ file: "(search)", line: 0, text: `Search error: ${err.message || String(err)}` }];
  }
}
