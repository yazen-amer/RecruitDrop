import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ingestSource } from "@/lib/ingestion/run";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await getDb().source.findMany({
    where: {
      enabled: true,
      OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }],
    },
    // Serial, robots-paced crawls must fit inside the platform execution budget.
    take: 1,
    orderBy: { nextCheckAt: "asc" },
  });
  const results = [];
  for (const source of sources) {
    try {
      const run = await ingestSource(source.id);
      results.push({ sourceId: source.id, status: run.status.toLowerCase(), runId: run.id, discovered: run.discoveredCount, created: run.createdCount, updated: run.updatedCount, failed: run.errorCount });
    } catch (error) {
      results.push({
        sourceId: source.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}
