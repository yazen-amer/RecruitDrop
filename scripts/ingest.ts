import { getDb } from "../lib/db";
import { ingestSource } from "../lib/ingestion/run";

const db = getDb();
const requestedId = process.argv[2];
const sources = requestedId
  ? await db.source.findMany({ where: { id: requestedId } })
  : await db.source.findMany({ where: { enabled: true }, orderBy: { name: "asc" } });

if (!sources.length) {
  console.error(
    requestedId
      ? `No source found with id ${requestedId}`
      : "No enabled sources found. Run pnpm db:seed first.",
  );
  process.exitCode = 1;
} else {
  for (const source of sources) {
    try {
      const run = await ingestSource(source.id);
      console.log(
        `${source.name}: ${run.status.toLowerCase()} — ${run.discoveredCount} discovered, ${run.createdCount} created, ${run.updatedCount} updated`,
      );
    } catch (error) {
      process.exitCode = 1;
      console.error(
        `${source.name}: failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

await db.$disconnect();
