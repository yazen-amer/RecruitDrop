import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { submissionSchema } from "@/lib/ingestion/schema";
const recent = new Map<string, number>();
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const now = Date.now();
    if (now - (recent.get(ip) || 0) < 15_000)
      return NextResponse.json(
        { error: "Please wait before submitting another URL." },
        { status: 429 },
      );
    const parsed = submissionSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid public HTTP(S) URL." },
        { status: 400 },
      );
    recent.set(ip, now);
    const db = getDb();
    const source = await db.source.upsert({
      where: { url: parsed.data.url },
      create: {
        name: new URL(parsed.data.url).hostname,
        url: parsed.data.url,
        kind: "SUBMISSION",
        enabled: false,
      },
      update: {},
    });
    const submission = await db.submittedEvent.create({
      data: {
        url: parsed.data.url,
        sourceId: source.id,
        submitterIp: ip === "unknown" ? null : ip,
      },
    });
    return NextResponse.json(
      { id: submission.id, status: submission.status },
      { status: 202 },
    );
  } catch (error) {
    console.error("submission_failed", error);
    return NextResponse.json(
      {
        error: process.env.DATABASE_URL
          ? "We couldn’t save that URL. Please try again."
          : "Submissions are disabled until the database is configured.",
      },
      { status: 503 },
    );
  }
}
