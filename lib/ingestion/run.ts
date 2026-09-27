import { getDb } from "@/lib/db";
import { fetchSourceDocuments, parseSourceConfig } from "./fetch";
import { extractEvents } from "./extract";
import { normalize, similarity } from "./dedupe";
const slugify = (s: string) => normalize(s).replaceAll(" ", "-").slice(0, 70);
export async function ingestSource(sourceId: string) {
  const db = getDb();
  const source = await db.source.findUniqueOrThrow({ where: { id: sourceId } });
  const run = await db.ingestionRun.create({
    data: { sourceId, status: "RUNNING", startedAt: new Date() },
  });
  let created = 0,
    updated = 0;
  try {
    const config = parseSourceConfig(source.config);
    const documents = await fetchSourceDocuments(source);
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
    const pages = extracted.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (!pages.length && failures.length) throw failures[0].reason;
    const events = pages.flatMap((page) =>
      page.events.map((event) => ({ event, sourceUrl: page.sourceUrl })),
    );
    for (const { event: item, sourceUrl } of events) {
      if (!item.startAt) continue;
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
          companyId: company?.id,
        },
        include: { sources: true },
      });
      const duplicate = candidates.find(
        (c) =>
          similarity(c.title, item.title) >= 0.65 ||
          c.sources.some(
            (s) => s.sourceUrl === sourceUrl,
          ),
      );
      if (duplicate) {
        await db.event.update({
          where: { id: duplicate.id },
          data: {
            description: duplicate.description || item.description,
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
            slug: `${base}-${new Date(item.startAt).toISOString().slice(0, 10)}`,
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
    }
    await db.source.update({
      where: { id: sourceId },
      data: {
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + (config.intervalHours ?? 12) * 36e5),
      },
    });
    return await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: failures.length ? "PARTIAL" : "SUCCEEDED",
        finishedAt: new Date(),
        discoveredCount: events.length,
        createdCount: created,
        updatedCount: updated,
        errorCount: failures.length,
        errorLog: failures.length
          ? failures.map((failure) => ({
              message:
                failure.status === "rejected" && failure.reason instanceof Error
                  ? failure.reason.message
                  : "Detail page extraction failed",
            }))
          : undefined,
      },
    });
  } catch (error) {
    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorCount: 1,
        errorLog: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
    });
    throw error;
  }
}
