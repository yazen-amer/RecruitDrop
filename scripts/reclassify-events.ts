import { getDb } from "../lib/db";
import { careerCategories, inferHost } from "../lib/ingestion/metadata";
import { normalize } from "../lib/ingestion/dedupe";

// Dry run by default. Changes only host/category fields, never events or source references.
const apply = process.argv.includes("--apply");
const db = getDb();
try {
  const events = await db.event.findMany({ where: { isPublished: true, isMock: false, startAt: { gte: new Date() } }, include: { company: true, sources: { select: { rawPayload: true } } }, orderBy: { startAt: "asc" } });
  let changed = 0;
  for (const event of events) {
    const company = inferHost(event.title, event.description ?? "", event.company?.name ?? null);
    const descriptions = new Set([event.description ?? ""]);
    for (const source of event.sources) {
      const payload = source.rawPayload;
      if (payload && typeof payload === "object" && !Array.isArray(payload) && typeof payload.description === "string") descriptions.add(payload.description);
    }
    const categories = careerCategories(event.title, [...descriptions].join("\n"), company, event.startAt.toISOString());
    if (company === (event.company?.name ?? null) && JSON.stringify(categories) === JSON.stringify(event.careerCategories)) continue;
    console.log(JSON.stringify({ id: event.id, title: event.title, before: { host: event.company?.name ?? null, categories: event.careerCategories }, after: { host: company, categories } }));
    if (apply) await db.$transaction(async tx => {
      const host = company ? await tx.company.upsert({ where: { normalizedName: normalize(company) }, create: { name: company, normalizedName: normalize(company) }, update: {} }) : null;
      const result = await tx.event.updateMany({ where: { id: event.id, updatedAt: event.updatedAt }, data: { companyId: host?.id ?? null, careerCategories: categories } });
      if (result.count !== 1) throw new Error(`Event ${event.id} changed during review; retry a fresh dry run.`);
    });
    changed++;
  }
  console.log(`${apply ? "Applied" : "Dry run"}: ${changed} metadata changes across ${events.length} upcoming published events. No event/source records deleted.`);
} finally {
  await db.$disconnect();
}
