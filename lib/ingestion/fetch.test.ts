import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSourceDocuments, robotsPolicy } from "./fetch";

afterEach(() => vi.unstubAllGlobals());

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
