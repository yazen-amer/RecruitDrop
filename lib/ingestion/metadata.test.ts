import { describe, expect, it } from "vitest";
import { careerCategories, inferHost, normalizeHost } from "./metadata";

describe("career purpose classification", () => {
  it.each([
    ["Visa Tech Recruiting", "Technology strategy and innovation; meet recruiters.", ["Other"]],
    ["ChatGPT for Job Seekers", "Use artificial intelligence to improve your resume.", ["Other"]],
    ["Cornell Business Forum", "Artificial intelligence and leadership; networking with alumni.", ["Other"]],
    ["Finance Alumni Career Panel", "A former software engineer shares her biography.", ["Finance"]],
    ["Software Engineering Internship Info Session", "The employer also works in finance and healthcare.", ["SWE"]],
    ["Strategy and Product at Jane Street", "Finance employer recruiting", ["Product"]],
    ["Federal Resume Workshop", "Department of Health and Human Services application tips.", ["Government / Policy"]],
    ["General Career Fair", "Explore opportunities. Bring personal data; share on social media.", ["Other"]],
    ["Engineering and Scientific Consulting Careers", "Career opportunities", ["Consulting", "Engineering"]],
    ["Career Conversations", "Careers in financial services, healthcare, marketing and entertainment.", ["Finance", "Healthcare", "Marketing / Media"]],
    ["College of Engineering Employer Tabling", "Meet recruiters in Duffield Hall.", ["Other"]],
  ])("classifies %s using career evidence", (title, description, expected) => {
    expect(careerCategories(title, description)).toEqual(expected);
  });
  it("does not borrow other dates' speaker disciplines from a series description", () => {
    const description = "Alumni career journeys. October 23: Software engineering careers. November 13: Investment banking careers.";
    expect(careerCategories("Fridays with Alumni", description, null, "2099-10-23T12:00:00-04:00")).toEqual(["SWE"]);
    expect(careerCategories("Fridays with Alumni", description, null, "2099-11-13T12:00:00-05:00")).toEqual(["Finance"]);
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
