import { describe, expect, it } from "vitest";
import { defaultFilters, filterEvents, filterParams, parseFeedFilters } from "./feed";
import { mockEvents } from "./mock-events";
const now = Date.parse("2099-01-01T00:00:00Z");
const event = { ...mockEvents[0], startAt: "2099-01-03T12:00:00Z", description: "An internship in software engineering", location: "Gates Hall", categories: ["SWE"] };
describe("personalized radar", () => {
  it("round trips shareable filters and ignores invalid values", () => {
    const view = { ...defaultFilters, category: "ML / AI", query: "internship", dateRange: "7" };
    expect(parseFeedFilters(filterParams(view))).toEqual(view);
    expect(parseFeedFilters(new URLSearchParams("area=Fake&days=-7&type=Fake"))).toEqual(defaultFilters);
  });
  it("searches descriptions and locations with case-independent words", () => {
    expect(filterEvents([event], { ...defaultFilters, query: "GATES internship" }, now)).toHaveLength(1);
    expect(filterEvents([event], { ...defaultFilters, query: "Gates finance" }, now)).toHaveLength(0);
  });
  it("excludes expired events even when the initial feed is stale", () => {
    expect(filterEvents([event], defaultFilters, Date.parse("2099-01-04T12:00:00Z"))).toEqual([]);
  });
  it("combines career area, date, type and format filters", () => {
    expect(filterEvents([event], { ...defaultFilters, category: "Finance" }, now)).toEqual([]);
    expect(filterEvents([event], { ...defaultFilters, dateRange: "7", eventType: event.type }, now)).toHaveLength(1);
    expect(filterEvents([{ ...event, startAt: "2099-02-01T12:00:00Z" }], { ...defaultFilters, dateRange: "7" }, now)).toEqual([]);
  });
});
