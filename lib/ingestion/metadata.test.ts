import { describe, expect, it } from "vitest";
import { careerCategories, inferHost, normalizeHost, reconcileCategories, structuredHost, retainedDescriptions } from "./metadata";

describe("career purpose classification", () => {
  it.each([
    ["Visa Tech Recruiting", "Technology strategy and innovation; meet recruiters.", []],
    ["ChatGPT for Job Seekers", "Use artificial intelligence to improve your resume.", []],
    ["Cornell Business Forum", "Artificial intelligence and leadership; networking with alumni.", []],
    ["Finance Alumni Career Panel", "A former software engineer shares her biography.", ["Finance"]],
    ["Software Engineering Internship Info Session", "The employer also works in finance and healthcare.", ["SWE"]],
    ["Strategy and Product at Jane Street", "Finance employer recruiting", ["Product"]],
    ["Federal Resume Workshop", "Department of Health and Human Services application tips.", ["Government / Policy"]],
    ["General Career Fair", "Explore opportunities. Bring personal data; share on social media.", []],
    ["Engineering and Scientific Consulting Careers", "Career opportunities", ["Consulting", "Engineering"]],
    ["Career Conversations", "Careers in financial services, healthcare, marketing and entertainment.", ["Finance", "Healthcare", "Marketing / Media"]],
    ["College of Engineering Employer Tabling", "Meet recruiters in Duffield Hall.", []],
    ["Cornell Marine Officer Program Tabling Event", "Learn about officer recruiting in aviation, cyber, and logistics.", ["Government / Policy"]],
    ["UBS Investment Banking Info Session", "A speaker previously worked in public policy.", ["Finance"]],
    ["Residential Real Estate Career Day", "Explore real estate careers with Cooper & Cooper.", ["Finance"]],
    ["EPA Early Career Hiring Webinar", "Our mission protects public health. Meet engineers and scientists about career opportunities.", ["Engineering", "Science / Biotech"]],
  ])("classifies %s using career evidence", (title, description, expected) => {
    expect(careerCategories(title, description)).toEqual(expected);
  });
  it("does not borrow other dates' speaker disciplines from a series description", () => {
    const description = "Alumni career journeys. October 23: Software engineering careers. November 13: Investment banking careers.";
    expect(careerCategories("Fridays with Alumni", description, null, "2099-10-23T12:00:00-04:00")).toEqual(["SWE"]);
    expect(careerCategories("Fridays with Alumni", description, null, "2099-11-13T12:00:00-05:00")).toEqual(["Finance"]);
  });
  it("does not borrow any speaker's discipline when a series date is unlisted", () => {
    expect(careerCategories("Latina/o Studies Fridays with Alumni", "Career conversations. October 23: Software engineering careers. November 13: Investment banking careers.", null, "2099-11-20T12:00:00-05:00")).toEqual([]);
  });
  it("scopes each source independently and preserves actual multi-category evidence", () => {
    const sources = ["Alumni advice. October 23: Software engineering careers. November 13: Finance careers.", "Alumni advice. October 23: Product management careers. November 13: Healthcare careers."];
    expect(reconcileCategories("Alumni Career Conversations", sources, null, "2099-10-23T12:00:00-04:00")).toEqual(["SWE", "Product"]);
    expect(reconcileCategories("Alumni Career Conversations", [...sources].reverse(), null, "2099-10-23T12:00:00-04:00")).toEqual(["SWE", "Product"]);
    expect(reconcileCategories("Jane Street Internship Recruiting", ["Software engineering roles."], "Jane Street", "2099-10-23T12:00:00-04:00")).toEqual(["SWE"]);
  });
  it("backfills from current retained source payloads instead of resurrecting stale canonical descriptions", () => {
    const descriptions = retainedDescriptions("Finance career opportunities.", [{ description: "Healthcare career opportunities." }, { description: "Product management careers." }]);
    expect(reconcileCategories("Employer Career Fair", descriptions, null, "2099-10-23T12:00:00-04:00")).toEqual(["Product", "Healthcare"]);
    expect(retainedDescriptions("Original details", [null, { description: null }])).toEqual(["Original details"]);
  });
});
describe("host evidence", () => {
  it("prioritizes explicit organizers over brands in titles and biographies", () => {
    expect(inferHost("Goldman Sachs Career Panel", "A former Visa executive speaks.", "Cornell Career Services")).toBe("Cornell Career Services");
    expect(inferHost("Goldman Sachs Career Panel", "Hosted by Cornell Career Services.")).toBe("Cornell Career Services");
  });
  it("recovers clear title and hosting statements", () => {
    expect(inferHost("Get to Know Goldman Sachs")).toBe("Goldman Sachs");
    expect(inferHost("Summer Internship Roles", "Compass Lexecon will be hosting an information session.")).toBe("Compass Lexecon");
    expect(inferHost("Cornell Internship Recruitment", "Please join Efficio’s Cornell information session.")).toBe("Efficio");
    expect(inferHost("Career Conversations", "This event is hosted by Family Fellows Committee.")).toBe("Family Fellows Committee");
  });
  it("prefers a clear title employer over a description invitation and rejects ambiguous joint hosts", () => {
    expect(inferHost("Goldman Sachs Info Session", "Join Jane Street for a separate webinar.")).toBe("Goldman Sachs");
    expect(inferHost("Goldman Sachs and Jane Street Career Panel")).toBeNull();
    expect(structuredHost([{ "@type": "Person", name: "Jane Doe" }, { "@type": "Organization", name: "Cornell Career Services" }])).toBe("Cornell Career Services");
  });
  it("preserves unknowns and avoids a speaker's former employer", () => {
    expect(inferHost("Career Workshop", "Our speaker formerly worked at Jane Street and Visa.")).toBeNull();
    expect(inferHost("Career workshop on consulting ")).toBeNull();
    expect(normalizeHost("Unknown")).toBeNull();
    expect(normalizeHost("Visa Tech")).toBe("Visa");
    expect(normalizeHost("Jane Street Research Department")).toBe("Jane Street Research Department");
    expect(inferHost("2026 Virtual STEM Career Fair", "Meet employers.", "2026 Virtual STEM")).toBeNull();
    expect(inferHost("Summer 2027 National Park Service Business Plan Internship Information Session", "Join the Purposeful Growth Institute for a recruiting session.", "Summer 2027 National Park Service Business Plan Internship")).toBe("Purposeful Growth Institute");
    expect(inferHost("Career Workshop", "Join AAP Career Development and TBD student group for an event.")).toBe("AAP Career Development");
    expect(inferHost("Career Workshop", "Join TBD student group for an event.")).toBeNull();
  });
});
