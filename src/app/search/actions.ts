"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FileMatch = {
  file: string;
  line: number;
  text: string;
};

export async function searchWorkspace(term: string): Promise<FileMatch[]> {
  const q = term.trim();
  if (!q) return [];

  // Restrict search to a small allowlist.
  const paths = [
    "/home/ivan/clawd/MEMORY.md",
    "/home/ivan/clawd/TODO.md",
    "/home/ivan/clawd/README.md",
    "/home/ivan/clawd/memory",
  ];

  // ripgrep output: file:line:match
  // -n line numbers, -H filenames, --no-heading, --color never
  // --glob to limit file types inside memory/
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

  // Prefer ripgrep if installed, otherwise fall back to grep.
  try {
    const { stdout } = await execFileAsync("rg", args, {
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });

    const lines = stdout.split("\n").filter(Boolean);
    return lines.slice(0, 50).map((line) => {
      const first = line.indexOf(":");
      const second = line.indexOf(":", first + 1);
      const file = line.slice(0, first);
      const lineNo = Number(line.slice(first + 1, second));
      const text = line.slice(second + 1);
      return { file, line: lineNo, text };
    });
  } catch (err: any) {
    // rg exits code 1 when no matches; treat as empty.
    if (typeof err?.code === "number" && err.code === 1) return [];

    // If rg isn't installed, try grep.
    if ((err?.code === "ENOENT" || /not found/i.test(err?.message || ""))) {
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
        const lines = stdout.split("\n").filter(Boolean);
        return lines.slice(0, 50).map((line) => {
          const first = line.indexOf(":");
          const second = line.indexOf(":", first + 1);
          const file = line.slice(0, first);
          const lineNo = Number(line.slice(first + 1, second));
          const text = line.slice(second + 1);
          return { file, line: lineNo, text };
        });
      } catch (e: any) {
        if (typeof e?.code === "number" && e.code === 1) return [];
        return [
          {
            file: "(search)",
            line: 0,
            text: `Search error: ${e?.message || String(e)}`,
          },
        ];
      }
    }

    return [
      {
        file: "(search)",
        line: 0,
        text: `Search error: ${err?.message || String(err)}`,
      },
    ];
  }
}
