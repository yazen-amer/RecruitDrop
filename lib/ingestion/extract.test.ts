import { afterEach, describe, expect, it, vi } from "vitest";
import { extractEvents, extractStructuredEvents } from "./extract";

describe("structured event extraction", () => {
  it("recognizes Organization organizers and preserves unknowns for a speaker-only event", () => {
    const content = (organizer: object) => `__JSON_LD_START__${JSON.stringify({ "@type": "Event", name: "Career Workshop", description: "Explore internship careers", startDate: "2099-10-01T18:00:00-04:00", organizer })}__JSON_LD_END__`;
    expect(extractStructuredEvents(content({ "@type": "Organization", name: "Cornell Career Services" }))?.[0].company).toBe("Cornell Career Services");
    expect(extractStructuredEvents(content({ "@type": "Person", name: "Jane Doe" }))?.[0].company).toBeNull();
  });
  it("does not turn all-day programme placeholders into midnight recruiting sessions", () => {
    const events = extractStructuredEvents(JSON.stringify({ events: [{ event: { title: "Global Careers Week", event_instances: [
      { event_instance: { start: "2099-11-02T00:00:00-05:00", all_day: true } },
      { event_instance: { start: "2099-11-02T17:00:00-05:00", all_day: false } },
    ] } }] }));
    expect(events).toHaveLength(1);
    expect(events?.[0].startAt).toBe("2099-11-02T17:00:00-05:00");
  });
  it("accepts explicit student alumni career advice but not unrelated alumni lectures", () => {
    const row = (title: string, description_text: string) => ({ event: { title, description_text, event_instances: [{ event_instance: { start: "2099-10-23T12:00:00-04:00" } }] } });
    const events = extractStructuredEvents(JSON.stringify({ events: [
      row("Fridays with Alumni", "Alums offer advice on preparing for an ever-changing workplace, discussing internships and employment."),
      row("Cornell Business Forum", "An evening of networking with fellow alumni and current students."),
      row("Alumni Science Lecture", "A professor discusses her career and her latest research discoveries."),
      row("Partner Meeting", "An evening of networking with fellow alumni and current students."),
    ] }));
    expect(events?.map(event => event.title)).toEqual(["Fridays with Alumni", "Cornell Business Forum"]);
  });
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
      organizer: { "@type": "Corporation", name: "Acme" },
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

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("sends JSON Schema null unions without a complexity-expanding maxItems", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"events":[]}' }] } }] })));
  vi.stubGlobal("fetch", fetchMock);
  expect(await extractEvents("Public career page", "https://example.edu/careers")).toEqual([]);
  const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(request.body));
  expect(url).not.toContain("test-key");
  expect(body.generationConfig.responseSchema).toBeUndefined();
  const schema = body.generationConfig.responseJsonSchema;
  expect(schema.properties.events.maxItems).toBeUndefined();
  expect(JSON.stringify(schema)).not.toContain("nullable");
  for (const field of ["company", "description", "startAt", "endAt", "location", "registrationUrl", "registrationDeadline"])
    expect(schema.properties.events.items.properties[field].type).toEqual(["string", "null"]);
});
it("sanity-checks Gemini categories and does not use a speaker's former employer as host", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  const event = { company: "Jane Street", title: "ChatGPT for Job Seekers", description: "Use AI tools to improve a resume. The speaker formerly worked at Jane Street.", startAt: "2099-10-01T18:00:00-04:00", endAt: null, location: null, mode: "UNKNOWN", type: "WORKSHOP", careerCategories: ["ML / AI", "Finance", "SWE"], registrationUrl: null, registrationDeadline: null, confidence: 0.9 };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [event] }) }] } }] }))));
  expect((await extractEvents(event.description, "https://example.edu/career-workshop"))[0]).toMatchObject({ company: null, careerCategories: ["Other"] });
});
it("does not borrow a different listing event's organizer or accept an invented host", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  const event = { company: null, title: "Career Workshop", description: "Explore career opportunities.", startAt: "2099-10-01T18:00:00-04:00", endAt: null, location: null, mode: "UNKNOWN", type: "WORKSHOP", careerCategories: [], registrationUrl: null, registrationDeadline: null, confidence: 0.9 };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [event, { ...event, title: "Acme Info Session", company: "Acme" }] }) }] } }] }))));
  const events = await extractEvents("Career Workshop. A separate event is hosted by Cornell Career Services.", "https://example.edu/events");
  expect(events.map(event => event.company)).toEqual([null, null]);
});
it("retains all upcoming Localist instances with their event URL", () => {
  const events = extractStructuredEvents(JSON.stringify({ events: [{ event: {
    title: "Employer Career Fair", description_text: "Meet recruiters", localist_url: "https://events.cornell.edu/event/fair",
    event_instances: [{ event_instance: { start: "2099-10-01T12:00:00Z" } }, { event_instance: { start: "2099-10-02T12:00:00Z" } }],
  } }] }));
  expect(events).toHaveLength(2);
  expect(events?.[1].sourceUrl).toBe("https://events.cornell.edu/event/fair");
});
it("does not ask Gemini to extract empty Cornell monthly archives", async () => {
  vi.stubGlobal("fetch", vi.fn());
  expect(await extractEvents("No events", "https://career.cornell.edu/events/2099/10/")).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});

it("parses the graduate careers API's UTC dates, explicit RSVP and unknown company", () => {
  const events = extractStructuredEvents(JSON.stringify({ total_pages: 1, events: [{
    title: "Learn about a career in engineering and scientific consulting",
    description: '<p>Explore career opportunities.</p><a href="https://example.edu/register">Please RSVP</a>',
    utc_start_date: "2099-10-15 19:00:00", utc_end_date: "2099-10-15 20:00:00",
    venue: { venue: "Plant Science 404" }, url: "https://gradcareers.cornell.edu/event/consulting/", all_day: false,
  }] }));
  expect(events?.[0]).toMatchObject({ company: null, startAt: "2099-10-15T19:00:00Z", location: "Plant Science 404", registrationUrl: "https://example.edu/register", careerCategories: ["Consulting", "Engineering"] });
});
it("rejects general tech talks without a recruiting purpose", () => {
  expect(extractStructuredEvents(JSON.stringify({ events: [{ event: { title: "Physics Tech Talk", description_text: "Research seminar", event_instances: [{ event_instance: { start: "2099-10-15T19:00:00Z" } }] } }] }))).toEqual([]);
});

it("excludes explicitly cancelled recruiting events", () => {
  expect(extractStructuredEvents(JSON.stringify({ events: [{ event: { title: "CANCELLED Employer Career Fair", description_text: "Meet recruiters", event_instances: [{ event_instance: { start: "2099-10-15T19:00:00Z" } }] } }] }))).toEqual([]);
});

it("does not fabricate an employer from a title with trailing whitespace", () => {
  const events = extractStructuredEvents(JSON.stringify({ events: [{ event: { title: "Career workshop on consulting ", description_text: "Explore career options", event_instances: [{ event_instance: { start: "2099-10-15T19:00:00Z" } }] } }] }));
  expect(events?.[0].company).toBeNull();
});
