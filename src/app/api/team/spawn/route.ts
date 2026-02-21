import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TEAM_MEMBERS } from "@/lib/team";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { memberId?: string; task?: string };
    if (!body.memberId) return NextResponse.json({ ok: false, error: "memberId is required" }, { status: 400 });

    const member = TEAM_MEMBERS.find((m) => m.id === body.memberId);
    if (!member) return NextResponse.json({ ok: false, error: "Unknown member" }, { status: 404 });

    const message = [
      `Role: ${member.name} (${member.role})`,
      `Brief: ${member.roleBrief}`,
      body.task ? `Task: ${body.task}` : "Task: No explicit task provided. Propose next 3 highest-impact tasks for your role.",
      "Return a short action plan with assumptions and deliverables.",
    ].join("\n\n");

    const { stdout } = await execFileAsync("openclaw", ["agent", "--agent", member.id, "--message", message, "--json"], {
      cwd: "/home/ivan/clawd",
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    });

    return NextResponse.json({ ok: true, member: member.name, output: stdout.slice(0, 8000) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "spawn failed" },
      { status: 500 },
    );
  }
}
