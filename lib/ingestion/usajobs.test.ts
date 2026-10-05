import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractStructuredEvents } from "./extract";
const url = "https://www.usajobs.gov/Event?IsOnline=true";
const card = (title = "EPA Early Career Hiring Webinar", zone = "ET", audience = "Students Recent graduates", location = "Online", date = "October 8, 2026") => `&body=https://www.usajobs.gov/Event/5739 Email (Opens in a new window) X (Opens in a new window) ${title} ${date} 1 p.m. &#x2013; 2 p.m. ${zone} ${location} __URL__https://example.gov/register Visit event website Meet scientists and engineers about internship hiring. Expand Hide details and jobs Hosted by Environmental Protection Agency ${audience}`;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
describe("official USAJOBS events", () => {
  it("extracts explicit agency, source and registration links without Gemini", () => {
    expect(extractStructuredEvents(card(), url)).toEqual([expect.objectContaining({ sourceUrl: "https://www.usajobs.gov/Event/5739", company: "Environmental Protection Agency", startAt: "2026-10-08T13:00:00-04:00", endAt: "2026-10-08T14:00:00-04:00", mode: "VIRTUAL", registrationUrl: "https://example.gov/register", registrationDeadline: null, careerCategories: ["Engineering", "Science / Biotech", "Government / Policy"] })]);
  });
  it("preserves explicit standard time and resolves regional daylight time", () => {
    expect(extractStructuredEvents(card(undefined, "EST"), url)?.[0].startAt).toBe("2026-10-08T13:00:00-05:00");
    expect(extractStructuredEvents(card(undefined, "PT"), url)?.[0].startAt).toBe("2026-10-08T13:00:00-07:00");
  });
  it("excludes executive, licensed-veterinarian and restricted-audience recruitment", () => {
    for (const content of [card("NASA Chief Officer", "ET", "Open to the public Senior executives"), card("Veterinarians Hiring Fair"), card("IRS Veterans and Military Spouses"), card(undefined, "ET", "Veterans Military spouses")]) expect(extractStructuredEvents(content, url)).toEqual([]);
  });
  it("excludes in-person, unknown time zones, invalid dates, past and distant events", () => {
    for (const content of [card(undefined, "ET", undefined, "Ithaca"), card(undefined, "XYZ"), card(undefined, "ET", undefined, undefined, "February 31, 2027"), card(undefined, "ET", undefined, undefined, "October 1, 2026"), card(undefined, "ET", undefined, undefined, "May 1, 2027")]) expect(extractStructuredEvents(content, url)).toEqual([]);
  });
  it("does not borrow eligibility from the next event or filter controls", () => {
    expect(extractStructuredEvents(card(undefined, "ET", "Veterans Military spouses OCT 9 Next event Students") + " Filters Students", url)).toEqual([]);
    const events = extractStructuredEvents(card() + card("HHS Careers 101", "ET", "Open to the public"), url);
    expect(events).toHaveLength(2);
    expect(events?.[0].description).not.toContain("HHS");
  });
});
