import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

  const expected = process.env.ACTIVITY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "ACTIVITY_INGEST_TOKEN not set" }, { status: 500 });
  }
  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "CONVEX_URL not set" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  const tasks = await client.query(api.taskBoard.list, {});
  return NextResponse.json({ ok: true, tasks });
}
