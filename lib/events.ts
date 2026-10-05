import { getDb } from "./db";
import type { RecruitingEvent } from "./types";

const colors = ["#163c3c", "#173d70", "#6b2d3e", "#526b12", "#5b3b73"];

function colorFor(value: string) {
  const score = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[score % colors.length];
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

const include = {
  company: true,
  sources: { include: { source: true }, orderBy: { firstSeenAt: "asc" as const } },
};

type DatabaseEvent = Awaited<
  ReturnType<ReturnType<typeof getDb>["event"]["findFirst"]>
>;

function toRecruitingEvent(event: NonNullable<DatabaseEvent> & {
  company: { name: string } | null;
  sources: { sourceUrl: string; source: { name: string } }[];
}): RecruitingEvent {
  const source = event.sources[0];
  const company = event.company?.name ?? "Host not listed";
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? "See the original source for full details.",
    company,
    companyKnown: Boolean(event.company),
    registrationIsDirect: Boolean(event.registrationUrl),
    sources: event.sources.map((entry) => ({ name: entry.source.name, url: entry.sourceUrl })),
    companyInitials: initials(company),
    companyColor: colorFor(company),
    startAt: event.startAt.toISOString(),
    endAt: event.endAt?.toISOString(),
    location: event.location ?? (event.mode === "VIRTUAL" ? "Online" : "Details pending"),
    mode: event.mode,
    type: event.type,
    categories: event.careerCategories,
    registrationUrl: event.registrationUrl ?? source?.sourceUrl ?? "#",
    sourceName: source?.source.name ?? "Public source",
    sourceUrl: source?.sourceUrl ?? event.registrationUrl ?? "#",
    discoveredAt: event.discoveredAt.toISOString(),
    deadline: event.registrationDeadline?.toISOString(),
    confidence: event.extractionConfidence ?? undefined,
    isMock: event.isMock,
  };
}

export async function getUpcomingEvents() {
  const events = await getDb().event.findMany({
    where: { isPublished: true, isMock: false, startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take: 200,
    include,
  });
  return events.map((event) => toRecruitingEvent(event));
}

export async function getEventBySlug(slug: string) {
  const event = await getDb().event.findFirst({
    where: { slug, isPublished: true, isMock: false },
    include,
  });
  return event ? toRecruitingEvent(event) : null;
}

export async function getLastSourceScan() {
  const run = await getDb().ingestionRun.findFirst({ where: { status: { in: ["SUCCEEDED", "PARTIAL"] }, source: { enabled: true }, finishedAt: { not: null } }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } });
  return run?.finishedAt?.toISOString();
}
