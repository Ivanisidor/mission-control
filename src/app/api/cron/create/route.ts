import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      whenIso?: string;
      assignee?: "ivan" | "nux";
      notes?: string;
    };

    if (!body.name || !body.whenIso) {
      return NextResponse.json({ ok: false, error: "name and whenIso are required" }, { status: 400 });
    }

    const when = new Date(body.whenIso);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid whenIso" }, { status: 400 });
    }

    const message = [
      `Scheduled task: ${body.name}`,
      body.assignee ? `Assignee: ${body.assignee}` : undefined,
      body.notes ? `Notes: ${body.notes}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    await execFileAsync(
      "openclaw",
      [
        "cron",
        "add",
        "--name",
        body.name,
        "--at",
        when.toISOString(),
        "--message",
        message,
        "--agent",
        "main",
      ],
      { cwd: "/home/ivan/clawd" },
    );

    await execFileAsync("node", ["scripts/sync-cron.mjs"], { cwd: "/home/ivan/clawd/mission-control" });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
