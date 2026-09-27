import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSourceDocuments } from "./fetch";

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
