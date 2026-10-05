import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    source: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    ingestionRun: { create: vi.fn(), update: vi.fn() },
    company: { upsert: vi.fn() },
    event: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  fetch: vi.fn(), extract: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: () => mocks.db }));
vi.mock("./fetch", () => ({ fetchSourceDocuments: mocks.fetch, parseSourceConfig: () => ({ intervalHours: 12 }) }));
vi.mock("./extract", () => ({ extractEvents: mocks.extract }));
import { ingestSource } from "./run";

const item = {
  company: null, title: "Employer Career Fair", description: null,
  startAt: "2099-10-15T19:00:00Z", endAt: null, location: null,
  mode: "UNKNOWN", type: "CAREER_FAIR", careerCategories: ["Other"],
  registrationUrl: null, registrationDeadline: null, confidence: 0.9,
  sourceUrl: "https://example.edu/event/fair",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.source.findUniqueOrThrow.mockResolvedValue({ id: "source", name: "Calendar", url: "https://example.edu/events", config: {} });
  mocks.db.ingestionRun.create.mockResolvedValue({ id: "run" });
  mocks.db.ingestionRun.update.mockImplementation(async ({ data }) => data);
  mocks.db.event.findMany.mockResolvedValue([]);
  mocks.fetch.mockResolvedValue([{ url: "https://example.edu/events", content: "events" }]);
  mocks.extract.mockResolvedValue([item]);
});
describe("ingestion persistence", () => {
  it("retains an additional source reference on a duplicate event", async () => {
    mocks.db.event.findMany.mockResolvedValue([{ id: "existing", title: item.title, normalizedTitle: "employer career fair", startAt: new Date(item.startAt), location: null, company: null, companyId: null, mode: "UNKNOWN", careerCategories: ["Other"], sources: [{ sourceUrl: "https://another.edu/event/fair" }] }]);
    const run = await ingestSource("source");
    expect(run.updatedCount).toBe(1);
    expect(mocks.db.event.create).not.toHaveBeenCalled();
    expect(mocks.db.event.update.mock.calls[0][0].data.sources.upsert.create).toMatchObject({ sourceId: "source", sourceUrl: item.sourceUrl });
  });
  it("removes stale keyword tags while retaining corroborated cross-source disciplines", async () => {
    mocks.extract.mockResolvedValue([{ ...item, description: "Healthcare career opportunities." }]);
    mocks.db.event.findMany.mockResolvedValue([{ id: "existing", title: item.title, normalizedTitle: "employer career fair", description: "Financial services careers.", startAt: new Date(item.startAt), location: null, company: null, companyId: null, mode: "UNKNOWN", careerCategories: ["SWE", "ML / AI", "Finance"], sources: [{ sourceUrl: "https://another.edu/event/fair" }] }]);
    await ingestSource("source");
    expect(mocks.db.event.update.mock.calls[0][0].data.careerCategories).toEqual(["Finance", "Healthcare"]);
  });
  it("isolates a failed event write and counts partial fetch failures", async () => {
    mocks.fetch.mockImplementation(async (_source, onFailure) => {
      onFailure("https://example.edu/event/broken", new Error("Source returned 503"));
      return [{ url: "https://example.edu/events", content: "events" }];
    });
    mocks.extract.mockResolvedValue([item, { ...item, title: "Second Employer Career Fair" }]);
    mocks.db.event.create.mockRejectedValueOnce(new Error("Write failed")).mockResolvedValueOnce({ id: "created" });
    const run = await ingestSource("source");
    expect(run).toMatchObject({ status: "PARTIAL", discoveredCount: 2, createdCount: 1, errorCount: 2 });
    expect(mocks.db.source.update).toHaveBeenCalled();
  });
});
