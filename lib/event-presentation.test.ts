import { expect, it } from "vitest";
import { eventAction, eventStructuredData } from "./event-presentation";
import { mockEvents } from "./mock-events";
it("labels source fallbacks as details instead of registration", () => {
  expect(eventAction({ ...mockEvents[0], registrationIsDirect: false }, 0).label).toBe("View details");
});
it("does not call passed deadlines closing soon", () => {
  expect(eventAction({ ...mockEvents[0], deadline: "2020-01-01T00:00:00Z" }, Date.parse("2026-10-05T12:00:00Z"))).toMatchObject({ closed: true, closingSoon: false, label: "View details" });
});
it("does not publish sample structured data or fabricate unknown hosts and places", () => {
  expect(eventStructuredData(mockEvents[0])).toBeNull();
  const data = eventStructuredData({ ...mockEvents[0], isMock: false, companyKnown: false, location: "Details pending", mode: "UNKNOWN" });
  expect(data).not.toHaveProperty("organizer"); expect(data).not.toHaveProperty("location");
});
