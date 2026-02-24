import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

  const expected = process.env.ACTIVITY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "ACTIVITY_INGEST_TOKEN not set" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid body: id required" }, { status: 400 });
  }

  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "CONVEX_URL not set" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    const result = await client.mutation(api.taskBoard.update, {
      id: body.id as Id<"taskBoardTasks">,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.assignee !== undefined && { assignee: body.assignee }),
      ...(body.project !== undefined && { project: body.project }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.acceptanceCriteria !== undefined && { acceptanceCriteria: body.acceptanceCriteria }),
      ...(body.artifactType !== undefined && { artifactType: body.artifactType }),
      ...(body.evidenceRef !== undefined && { evidenceRef: body.evidenceRef }),
      ...(body.verificationNote !== undefined && { verificationNote: body.verificationNote }),
      ...(body.verifiedBy !== undefined && { verifiedBy: body.verifiedBy }),
      ...(body.blockerOwner !== undefined && { blockerOwner: body.blockerOwner }),
      ...(body.blockerReason !== undefined && { blockerReason: body.blockerReason }),
      ...(body.unblockAction !== undefined && { unblockAction: body.unblockAction }),
      ...(body.deadlineAt !== undefined && { deadlineAt: body.deadlineAt }),
      ...(body.decisionRequired !== undefined && { decisionRequired: body.decisionRequired }),
    });
    return NextResponse.json({ ok: true, id: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
