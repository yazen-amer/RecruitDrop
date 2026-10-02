import { PrismaClient } from "@prisma/client";
import { mockEvents } from "../lib/mock-events";
import { normalize } from "../lib/ingestion/dedupe";
import { trustedSources } from "../lib/ingestion/sources";

const db = new PrismaClient();

const trustedUrls = trustedSources.map((source) => source.url);
const managedSourceNames = [
  ...trustedSources.map((source) => source.name),
  "Cornell Engineering Career Resources",
  "Cornell ILR CAHRS Events",
  "Cornell ILR Student Events",
  "Cornell Events \u2014 Career",
  "Cornell Events \u2014 Recruiting",
  "Cornell Events \u2014 Employer",
  "Cornell Events \u2014 Career Fair",
  "Cornell Events \u2014 Information Sessions",
  "Cornell Events \u2014 Internship",
  "Cornell Engineering",
  "Cornell Bowers CIS",
  "Cornell Handshake",
  "JPMorganChase Careers",
  "NVIDIA University Recruiting",
];
await db.source.updateMany({
  where: {
    name: { in: managedSourceNames },
    url: { notIn: trustedUrls },
  },
  data: { enabled: false },
});

for (const source of trustedSources) {
  await db.source.upsert({
    where: { url: source.url },
    create: source,
    update: {
      name: source.name,
      kind: source.kind,
      config: source.config,
      enabled: source.enabled,
    },
  });
}

const seedEvents = process.argv.includes("--sources-only") ? [] : mockEvents;
for (const item of seedEvents) {
  const company = await db.company.upsert({
    where: { normalizedName: normalize(item.company) },
    create: { name: item.company, normalizedName: normalize(item.company) },
    update: {},
  });
  const source = await db.source.upsert({
    where: { url: item.sourceUrl },
    create: { name: item.sourceName, url: item.sourceUrl },
    update: {},
  });
  await db.event.upsert({
    where: { slug: item.slug },
    create: {
      slug: item.slug,
      title: item.title,
      normalizedTitle: normalize(item.title),
      description: item.description,
      startAt: new Date(item.startAt),
      endAt: item.endAt ? new Date(item.endAt) : null,
      location: item.location,
      mode: item.mode,
      type: item.type,
      careerCategories: item.categories,
      registrationUrl: item.registrationUrl,
      registrationDeadline: item.deadline ? new Date(item.deadline) : null,
      isPublished: true,
      isMock: true,
      companyId: company.id,
      sources: { create: { sourceId: source.id, sourceUrl: item.sourceUrl } },
    },
    update: {},
  });
}
await db.$disconnect();
console.log(
  `Seeded ${seedEvents.length} mock events and synced ${trustedSources.length} trusted sources`,
);
