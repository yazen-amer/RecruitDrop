import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSourceDocuments, robotsPolicy } from "./fetch";

afterEach(() => vi.unstubAllGlobals());

it("expands only relevant recurring Cornell events within the detail bound", async () => {
  const event = (id: number, title: string) => ({ id, title, recurring: false, description_text: "A session", event_instances: [{ event_instance: { start: "2099-10-10T17:00:00-04:00" } }] });
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
    const body = url.endsWith("/api/2/events/1")
      ? { event: { ...event(1, "Employer Career Workshop"), event_instances: [{ event_instance: { start: "2099-10-10T17:00:00-04:00" } }, { event_instance: { start: "2099-11-10T17:00:00-05:00" } }] } }
      : { page: { total: 1 }, events: [{ event: event(1, "Employer Career Workshop") }, { event: event(2, "Research Seminar") }, { event: event(3, "Career Exploration") }] };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const docs = await fetchSourceDocuments({ url: "https://events.cornell.edu/api/2/events?distinct=true", kind: "API", config: { maxApiPages: 2, maxApiEventDetails: 1 } });
  expect(JSON.parse(docs[0].content).events[0].event.event_instances).toHaveLength(2);
  expect(fetchMock.mock.calls.map(([url]) => url.toString())).not.toContain("https://events.cornell.edu/api/2/events/2");
  expect(fetchMock.mock.calls.map(([url]) => url.toString())).not.toContain("https://events.cornell.edu/api/2/events/3");
});

it.each(["unavailable", "malformed"])("preserves Cornell listing data if a detail response is %s", async (failure) => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
    if (url.endsWith("/api/2/events/4")) return failure === "unavailable" ? new Response("Unavailable", { status: 503 }) : new Response("not JSON", { headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ events: [{ event: { id: 4, recurring: true, title: "Career Workshop", event_instances: [{ event_instance: { start: "2099-10-10T17:00:00-04:00" } }] } }] }), { headers: { "content-type": "application/json" } });
  }));
  const failed = vi.fn();
  const docs = await fetchSourceDocuments({ url: "https://events.cornell.edu/api/2/events", kind: "API", config: { maxApiEventDetails: 1 } }, failed);
  expect(JSON.parse(docs[0].content).events[0].event.event_instances).toHaveLength(1);
  expect(failed).toHaveBeenCalledWith("https://events.cornell.edu/api/2/events/4", expect.any(Error));
});

it("paginates USAJOBS within the listing limit and preserves virtual filters", async () => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => new Response(input.toString().endsWith("robots.txt") ? "User-agent: *\nAllow: /" : "<p><span>1</span> - <span>10</span> of <b>500</b> events</p>", { headers: { "content-type": "text/html" } }));
  vi.stubGlobal("fetch", fetchMock);
  const docs = await fetchSourceDocuments({ url: "https://www.usajobs.gov/Event?IsOnline=true", kind: "WEB_PAGE", config: { maxListingPages: 2 } });
  expect(docs.map(doc => doc.url)).toEqual(["https://www.usajobs.gov/Event?IsOnline=true", "https://www.usajobs.gov/Event?IsOnline=true&Page=2"]);
});

describe("fetchSourceDocuments", () => {
  it("follows only configured same-origin event links", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      const body = url.endsWith("/events/")
        ? '<a href="/events/acme-info-session/">Acme</a><a href="https://other.test/events/nope">Nope</a><a href="/about/">About</a>'
        : "<main>Acme recruiting info session on October 1.</main>";
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const documents = await fetchSourceDocuments({
      url: "https://career.example.edu/events/",
      kind: "WEB_PAGE",
      config: { maxDetailPages: 5, includePathPatterns: ["/events/"] },
    });

    expect(documents.map((document) => document.url)).toEqual([
      "https://career.example.edu/events/",
      "https://career.example.edu/events/acme-info-session/",
    ]);
  });

  it("rejects obvious private-network targets", async () => {
    await expect(
      fetchSourceDocuments({
        url: "http://192.168.1.4/events",
        kind: "WEB_PAGE",
        config: {},
      }),
    ).rejects.toThrow("Private network");
  });

  it("follows bounded monthly pagination and returns detail pages", async () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const root = `https://career.example.edu/events/${year}/${month}/`;
    const event = `${root}15/acme-coffee-chat/`;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      const body = url === root
        ? `<a href="${root}page/3/">Last</a>`
        : url.endsWith("page/2/")
          ? `<a href="${event}">Event</a>`
          : url === event
            ? "<title>Acme Coffee Chat</title><p>Date: October 15, 2099 Time: 3pm</p>"
            : "<p>No events</p>";
      return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const documents = await fetchSourceDocuments({
      url: "https://career.example.edu/events/",
      kind: "WEB_PAGE",
      config: { calendarMonthsAhead: 1, maxListingPages: 3, maxDetailPages: 5, preferDetailPages: true },
    });
    expect(documents.map(({ url }) => url)).toEqual([event]);
  });
});

it("honors specific robots groups, wildcard rules, allow precedence and crawl delay", () => {
  const robots = 'User-agent: *\nDisallow: /private/\nUser-agent: RecruitDrop\nDisallow: /events/*\nAllow: /events/public/\nCrawl-delay: 2';
  expect(robotsPolicy(robots, "https://example.edu/events/private/")).toEqual({ allowed: false, delay: 2000 });
  expect(robotsPolicy(robots, "https://example.edu/events/public/fair").allowed).toBe(true);
});
it("reports failed details while retaining successful pages", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
    if (url.endsWith("bad")) return new Response("Unavailable", { status: 503 });
    return new Response('<a href="/events/bad">Event</a>', { headers: { "content-type": "text/html" } });
  }));
  const failed = vi.fn();
  const docs = await fetchSourceDocuments({ url: "https://failures.example.edu/events/", kind: "WEB_PAGE", config: { maxDetailPages: 2, includePathPatterns: ["/events/"] } }, failed);
  expect(docs).toHaveLength(1);
  expect(failed).toHaveBeenCalledWith("https://failures.example.edu/events/bad", expect.any(Error));
});

it("paginates the public API within its configured bound", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => new Response(
    input.toString().endsWith("robots.txt") ? "User-agent: *\nAllow: /" : JSON.stringify({ page: { total: 100 }, events: [] }),
    { headers: { "content-type": "application/json" } },
  )));
  const docs = await fetchSourceDocuments({ url: "https://api.example.edu/api/2/events?pp=100", kind: "API", config: { maxApiPages: 2 } });
  expect(docs.map((doc) => doc.url)).toEqual(["https://api.example.edu/api/2/events?pp=100", "https://api.example.edu/api/2/events?pp=100&page=2"]);
});

it("retries a timed-out public page once without losing the source", async () => {
  let attempts = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    if (input.toString().endsWith("robots.txt")) return new Response("User-agent: *\nAllow: /");
    if (++attempts === 1) throw new DOMException("Timed out", "AbortError");
    return new Response('{"events":[]}', { headers: { "content-type": "application/json" } });
  }));
  const failure = vi.fn();
  const docs = await fetchSourceDocuments({ url: "https://retry.example.edu/api/events", kind: "API", config: {} }, failure);
  expect(docs).toHaveLength(1);
  expect(attempts).toBe(2);
  expect(failure).not.toHaveBeenCalled();
});
