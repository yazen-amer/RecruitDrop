import { describe, expect, it } from "vitest";
import { calendarContent } from "./calendar";
import { mockEvents } from "./mock-events";
describe("calendar subscription", () => {
  it("keeps stable event IDs and does not invent an end time", () => {
    const event = { ...mockEvents[0], endAt: undefined };
    const calendar = calendarContent([event], "2099-01-01T00:00:00Z");
    expect(calendar).toContain(`UID:${event.id}@recruitdrop`);
    expect(calendar).not.toContain("DTEND:");
    expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
  });
  it("escapes newline injection and folds long Unicode lines by bytes", () => {
    const calendar = calendarContent([{ ...mockEvents[0], title: "\u00e9".repeat(100), description: "Text\r\nEND:VEVENT\r\nBEGIN:VEVENT" }], "2099-01-01T00:00:00Z");
    expect(calendar.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(calendar.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
  });
});
