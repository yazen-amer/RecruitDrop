import { getDb } from "../lib/db";
import { ingestSource } from "../lib/ingestion/run";
const id = process.argv[2];
if (!id) {
  console.error("Usage: pnpm ingest <source-id>");
  process.exit(1);
}
const run = await ingestSource(id);
console.log(JSON.stringify(run, null, 2));
await getDb().$disconnect();
