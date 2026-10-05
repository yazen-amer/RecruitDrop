import { getDb } from "../db";
import { randomUUID } from "node:crypto";
import { fetchSourceDocuments, parseSourceConfig } from "./fetch";
import { extractEvents } from "./extract";
import { normalize, likelyDuplicate, canonicalUrl } from "./dedupe";
import { reconcileCategories, retainedDescriptions } from "./metadata";
const slugify = (s: string) => normalize(s).replaceAll(" ", "-").slice(0, 70);
export async function ingestSource(sourceId: string) {
  const db = getDb();
  const source = await db.source.findUniqueOrThrow({ where: { id: sourceId } });
  const run = await db.ingestionRun.create({
    data: { sourceId, status: "RUNNING", startedAt: new Date() },
  });
  let created = 0,
    updated = 0, skipped = 0, discovered = 0;
  const errors: { url: string; message: string }[] = [];
  try {
    const config = parseSourceConfig(source.config);
    const documents = await fetchSourceDocuments(source, (url, error) => {
      errors.push({ url, message: error instanceof Error ? error.message : "Fetch failed" });
    });
    const extracted: PromiseSettledResult<{
      sourceUrl: string;
      events: Awaited<ReturnType<typeof extractEvents>>;
    }>[] = [];
    for (let index = 0; index < documents.length; index += 4) {
      extracted.push(
        ...(await Promise.allSettled(
          documents.slice(index, index + 4).map(async (document) => ({
            sourceUrl: document.url,
            events: await extractEvents(document.content, document.url),
          })),
        )),
      );
    }
    const failures = extracted.filter((result) => result.status === "rejected");
    for (const [index, result] of extracted.entries()) if (result.status === "rejected")
      errors.push({ url: documents[index].url, message: result.reason instanceof Error ? result.reason.message : "Extraction failed" });
    const pages = extracted.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (!pages.length && failures.length) throw failures[0].reason;
    const events = pages.flatMap((page) =>
      page.events.map((event) => ({ event, sourceUrl: event.sourceUrl ?? page.sourceUrl })),
    );
    discovered = events.length;
    for (const { event: item, sourceUrl } of events) {
      if (!item.startAt || Date.parse(item.startAt) < Date.now() - 3_600_000) { skipped++; continue; }
      try {
        const company = item.company
          ? await db.company.upsert({
              where: { normalizedName: normalize(item.company) },
              create: {
                name: item.company,
                normalizedName: normalize(item.company),
              },
              update: { name: item.company },
            })
          : null;
        const windowStart = new Date(Date.parse(item.startAt) - 3 * 36e5),
          windowEnd = new Date(Date.parse(item.startAt) + 3 * 36e5);
        const candidates = await db.event.findMany({
          where: {
            startAt: { gte: windowStart, lte: windowEnd },
            isMock: false,
          },
          include: { sources: true, company: true },
          orderBy: [{ isPublished: "desc" }, { createdAt: "asc" }],
        });
        const duplicate = candidates.find((c) => likelyDuplicate({
          ...item, sourceUrl: c.sources.find((s) => canonicalUrl(s.sourceUrl) === canonicalUrl(sourceUrl))?.sourceUrl, title: c.title, company: c.company?.name ?? null,
          startAt: c.startAt.toISOString(), location: c.location, registrationUrl: c.registrationUrl,
        }, { ...item, sourceUrl }));
        if (duplicate) {
          const sameDetail = /\/event\/|\/events\/\d{4}\/\d{2}\/\d{2}\//i.test(new URL(sourceUrl).pathname) && duplicate.sources.some((s) => canonicalUrl(s.sourceUrl) === canonicalUrl(sourceUrl));
          const description = sameDetail && item.description ? item.description : duplicate.description || item.description;
          const otherPayloads = duplicate.sources.filter(s => !(s.sourceId === sourceId && canonicalUrl(s.sourceUrl) === canonicalUrl(sourceUrl))).map(s => s.rawPayload);
          const descriptions = [item.description, ...retainedDescriptions(sameDetail && item.description ? null : duplicate.description, otherPayloads)];
          await db.event.update({
            where: { id: duplicate.id },
            data: {
              title: sameDetail ? item.title : duplicate.title,
              normalizedTitle: sameDetail ? normalize(item.title) : duplicate.normalizedTitle,
              description,
              companyId: sameDetail ? company?.id ?? null : duplicate.companyId ?? company?.id,
              endAt: duplicate.endAt ?? (item.endAt ? new Date(item.endAt) : null),
              location: duplicate.location ?? item.location,
              mode: duplicate.mode === "UNKNOWN" ? item.mode : duplicate.mode,
              careerCategories: reconcileCategories(sameDetail ? item.title : duplicate.title, descriptions, sameDetail ? company?.name ?? null : duplicate.company?.name ?? company?.name ?? null, item.startAt),
              registrationUrl: duplicate.registrationUrl || item.registrationUrl,
              sources: {
                upsert: {
                  where: {
                    eventId_sourceId_sourceUrl: {
                      eventId: duplicate.id,
                      sourceId,
                      sourceUrl,
                    },
                  },
                  create: { sourceId, sourceUrl, rawPayload: item },
                  update: { rawPayload: item },
                },
              },
            },
          });
          updated++;
        } else {
          const base = slugify(`${item.company || "event"}-${item.title}`);
          await db.event.create({
            data: {
              slug: `${base}-${new Date(item.startAt).toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`,
              title: item.title,
              normalizedTitle: normalize(item.title),
              description: item.description,
              startAt: new Date(item.startAt),
              endAt: item.endAt ? new Date(item.endAt) : null,
              location: item.location,
              mode: item.mode,
              type: item.type,
              careerCategories: item.careerCategories,
              registrationUrl: item.registrationUrl,
              registrationDeadline: item.registrationDeadline
                ? new Date(item.registrationDeadline)
                : null,
              extractionConfidence: item.confidence,
              isPublished:
                config.autoPublishTrusted === true && item.confidence >= 0.65,
              companyId: company?.id,
              sources: {
                create: { sourceId, sourceUrl, rawPayload: item },
              },
            },
          });
          created++;
        }
      } catch (error) { errors.push({ url: sourceUrl, message: error instanceof Error ? error.message : "Persistence failed" }); }
    }
    await db.source.update({
      where: { id: sourceId },
      data: {
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + (config.intervalHours ?? 12) * 36e5),
      },
    });
    console.info(`${source.name}: ${discovered} discovered, ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} failed`);
    return await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: errors.length ? "PARTIAL" : "SUCCEEDED",
        finishedAt: new Date(),
        discoveredCount: events.length,
        createdCount: created,
        updatedCount: updated,
        errorCount: errors.length,
        errorLog: errors.length ? errors : undefined,
      },
    });
  } catch (error) {
    await db.source.update({ where: { id: sourceId }, data: { lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + 12 * 36e5) } });
    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        discoveredCount: discovered, createdCount: created, updatedCount: updated,
        errorCount: Math.max(1, errors.length),
        errorLog: [...errors, { url: source.url, message: error instanceof Error ? error.message : "Unknown error" }],
      },
    });
    throw error;
  }
}
