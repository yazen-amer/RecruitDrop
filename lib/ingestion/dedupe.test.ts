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
