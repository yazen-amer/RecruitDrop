import { describe, expect, it } from "vitest";
import { extractStructuredEvents } from "./extract";

describe("structured event extraction", () => {
  it("parses relevant Localist events and rejects unrelated events", () => {
    const content = JSON.stringify({
      events: [
        {
          event: {
            title: "NSA Information Session",
            description_text: "Meet recruiters and learn about internships.",
            experience: "inperson",
            location_name: "Gates Hall",
            ticket_url: "https://example.edu/register",
            localist_url: "https://events.cornell.edu/event/nsa",
            event_instances: [
              { event_instance: { start: "2099-09-26T17:00:00-04:00", end: "2099-09-26T18:00:00-04:00" } },
            ],
          },
        },
        {
          event: {
            title: "Ceramics Exhibition",
            description_text: "A gallery exhibition.",
            event_instances: [
              { event_instance: { start: "2099-09-26T17:00:00-04:00" } },
            ],
          },
        },
      ],
    });

    const events = extractStructuredEvents(content);
    expect(events).toHaveLength(1);
    expect(events?.[0]).toMatchObject({
      company: "NSA",
      title: "NSA Information Session",
      type: "INFO_SESSION",
      mode: "IN_PERSON",
    });
  });

  it("parses recruiting Event JSON-LD without an API call", () => {
    const content = `__JSON_LD_START__${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Acme Software Engineering Info Session",
      description: "Learn about internship hiring.",
      startDate: "2099-10-01T18:00:00-04:00",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: { name: "Zoom" },
      organizer: { name: "Acme" },
      url: "https://example.com/event",
    })}__JSON_LD_END__`;

    expect(extractStructuredEvents(content)?.[0]).toMatchObject({
      company: "Acme",
      mode: "VIRTUAL",
      type: "INFO_SESSION",
    });
  });

  it("parses Cornell Career Network event pages without an LLM call", () => {
    const content = `__PAGE_TITLE__BNP Paribas Coffee Chats &#8211; Cornell Career Network
      Oct 01 BNP Paribas Coffee Chats Date: Thursday, October 1, 2099 Time: 9am - 11am
      Join BNP Paribas recruiters to discuss internship and career opportunities.
      __URL__https://cornell.joinhandshake.com/events/2029097 Click here to attend Spread the word`;
    expect(
      extractStructuredEvents(
        content,
        "https://career.cornell.edu/events/2099/10/01/bnp-paribas-coffee-chats/",
      )?.[0],
    ).toMatchObject({
      company: "BNP Paribas",
      title: "BNP Paribas Coffee Chats",
      type: "COFFEE_CHAT",
      registrationUrl: "https://cornell.joinhandshake.com/events/2029097",
    });
  });
});
