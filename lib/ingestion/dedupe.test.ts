import { describe, expect, it } from "vitest";
import { canonicalUrl, likelyDuplicate, normalize, similarity } from "./dedupe";
import type { ExtractedEvent } from "./schema";
const event = (overrides: Partial<ExtractedEvent> = {}): ExtractedEvent => ({
  company: "Perplexity AI",
  title: "Campus Tech Talk at Cornell",
  description: null,
  startAt: "2026-09-23T18:00:00-04:00",
  endAt: null,
  location: "Gates Hall",
  mode: "IN_PERSON",
  type: "TECH_TALK",
  careerCategories: ["SWE"],
  registrationUrl: "https://example.com/event?utm_source=email",
  registrationDeadline: null,
  confidence: 0.9,
  ...overrides,
});
describe("deduplication", () => {
  it("normalizes punctuation and case", () =>
    expect(normalize("JPMorgan-Chase, Inc.")).toBe("jpmorgan chase inc"));
  it("strips tracking params", () =>
    expect(
      canonicalUrl("https://example.com/event/?utm_source=x&source=y"),
    ).toBe("https://example.com/event"));
  it("matches same URLs", () =>
    expect(
      likelyDuplicate(
        event(),
        event({
          title: "A different title",
          registrationUrl: "https://example.com/event/",
        }),
      ),
    ).toBe(true));
  it("matches similar title, company and time", () =>
    expect(
      likelyDuplicate(
        event({ registrationUrl: null }),
        event({
          title: "Cornell Campus Tech Talk",
          registrationUrl: null,
          startAt: "2026-09-23T19:00:00-04:00",
        }),
      ),
    ).toBe(true));
  it("rejects unrelated titles", () =>
    expect(
      similarity("Software info session", "Investment banking coffee chat"),
    ).toBeLessThan(0.65));
});

it("does not merge recurring events by registration URL alone", () => {
  expect(likelyDuplicate(event(), event({ startAt: "2026-09-24T18:00:00-04:00" }))).toBe(false);
});
it("does not merge events with conflicting locations or companies", () => {
  expect(likelyDuplicate(event(), event({ location: "Duffield Hall" }))).toBe(false);
  expect(likelyDuplicate(event(), event({ company: "Acme" }))).toBe(false);
});
it("matches the same event when one source omits the company", () => {
  expect(likelyDuplicate(event(), event({ company: null, registrationUrl: null }))).toBe(true);
});

it("uses an exact event detail URL to recognize refreshed company extraction", () => {
  expect(likelyDuplicate(event({ sourceUrl: "https://career.cornell.edu/events/2026/09/23/talk/" }), event({ sourceUrl: "https://career.cornell.edu/events/2026/09/23/talk/", company: "Corrected employer" }))).toBe(true);
});
it("recognizes refreshed employers on uppercase USAJOBS detail paths", () => {
  expect(likelyDuplicate(event({ sourceUrl: "https://www.usajobs.gov/Event/123" }), event({ sourceUrl: "https://www.usajobs.gov/Event/123", company: "Corrected agency" }))).toBe(true);
});
it("does not merge different events on a shared listing URL", () => {
  expect(likelyDuplicate(event({ sourceUrl: "https://events.cornell.edu/api/2/events", registrationUrl: null }), event({ sourceUrl: "https://events.cornell.edu/api/2/events", title: "Investment Banking Coffee Chat", registrationUrl: null }))).toBe(false);
});
