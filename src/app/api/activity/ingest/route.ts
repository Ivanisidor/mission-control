import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";

  const expected = process.env.ACTIVITY_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "ACTIVITY_INGEST_TOKEN not set" },
      { status: 500 }
    );
  }

  if (token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string" || typeof body.summary !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "CONVEX_URL not set" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  const id = await client.mutation(api.activityEvents.create, {
    type: body.type,
    summary: body.summary,
    details: body.details,
  });

  return NextResponse.json({ ok: true, id });
}
