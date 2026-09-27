import { z } from "zod";

export type SourceDocument = { url: string; content: string };

const sourceConfigSchema = z.object({
  maxDetailPages: z.number().int().min(0).max(120).optional(),
  includePathPatterns: z.array(z.string()).max(12).optional(),
  excludePathPatterns: z.array(z.string()).max(12).optional(),
  calendarMonthsAhead: z.number().int().min(0).max(12).optional(),
  maxListingPages: z.number().int().min(0).max(60).optional(),
  preferDetailPages: z.boolean().optional(),
  intervalHours: z.number().int().min(1).max(168).optional(),
  autoPublishTrusted: z.boolean().optional(),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export function parseSourceConfig(value: unknown): SourceConfig {
  return sourceConfigSchema.parse(value ?? {});
}

function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Unsupported URL protocol");
  const host = url.hostname.toLowerCase();
  if (
    ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) ||
    host.endsWith(".local") ||
    /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error("Private network URLs are not allowed");
  return url;
}

async function fetchText(raw: string) {
  assertPublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(raw, {
      signal: controller.signal,
      headers: {
        accept:
          "text/html,application/json,application/ld+json,application/xml,text/xml,text/calendar,text/plain",
        "user-agent": "RecruitDrop/1.0 (+public Cornell recruiting event index)",
      },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!/(html|json|xml|calendar|text\/plain)/i.test(type))
      throw new Error(`Unsupported source content type: ${type || "unknown"}`);
    return (await response.text()).slice(0, 1_500_000);
  } finally {
    clearTimeout(timer);
  }
}

function readableContent(raw: string) {
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw.slice(0, 120_000);
  const structured = [
    ...raw.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map((match) => `__JSON_LD_START__${match[1]}__JSON_LD_END__`)
    .join("\n");
  const pageTitle = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi, " __URL__$1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ");
  return `${structured}\n__PAGE_TITLE__${pageTitle}\n${text}`.slice(0, 120_000);
}

function discoverLinks(html: string, baseUrl: string, config: SourceConfig) {
  const base = new URL(baseUrl);
  const includes = config.includePathPatterns ?? [];
  const excludes = config.excludePathPatterns ?? [];
  const links = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
      url.hash = "";
      if (url.origin !== base.origin) continue;
      const value = `${url.pathname}${url.search}`;
      if (
        config.calendarMonthsAhead &&
        !/^\/events\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(url.pathname)
      )
        continue;
      if (
        includes.length &&
        !includes.some((pattern) => value.includes(pattern))
      )
        continue;
      if (excludes.some((pattern) => value.includes(pattern))) continue;
      links.add(url.toString());
    } catch {
      // Ignore malformed links from source HTML.
    }
  }
  return [...links].slice(0, config.maxDetailPages ?? 0);
}

function calendarListingUrls(baseUrl: string, monthsAhead: number) {
  const urls: string[] = [];
  const now = new Date();
  for (let offset = 0; offset < monthsAhead; offset++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const url = new URL(baseUrl);
    url.pathname = `/events/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/`;
    url.search = "";
    urls.push(url.toString());
  }
  return urls;
}

async function fetchInBatches(urls: string[], batchSize = 4) {
  const pages: { url: string; raw: string }[] = [];
  for (let index = 0; index < urls.length; index += batchSize) {
    const settled = await Promise.allSettled(
      urls.slice(index, index + batchSize).map(async (url) => ({
        url,
        raw: await fetchText(url),
      })),
    );
    for (const result of settled)
      if (result.status === "fulfilled") pages.push(result.value);
    if (index + batchSize < urls.length)
      await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return pages;
}

export async function fetchSourceDocuments(source: {
  url: string;
  kind: string;
  config: unknown;
}): Promise<SourceDocument[]> {
  assertPublicUrl(source.url);
  const config = parseSourceConfig(source.config);
  const listingUrls = config.calendarMonthsAhead
    ? calendarListingUrls(source.url, config.calendarMonthsAhead)
    : [source.url];
  const listings = await fetchInBatches(listingUrls);
  if (!listings.length) throw new Error("No source listing pages could be fetched");
  if (config.calendarMonthsAhead && config.maxListingPages) {
    const paginationUrls = [
      ...new Set(
        listings.flatMap(({ url, raw }) => {
          const base = new URL(url);
          const pages = [...raw.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].flatMap(
            (match): string[] => {
              try {
                const candidate = new URL(match[1], base);
                return candidate.origin === base.origin &&
                  /^\/events\/\d{4}\/\d{2}\/page\/\d+\/?$/.test(candidate.pathname)
                  ? [candidate.toString()]
                  : [];
              } catch {
                return [];
              }
            },
          );
          const highest = Math.max(1, ...pages.map((page) => Number(new URL(page).pathname.match(/\/page\/(\d+)/)?.[1] ?? 1)));
          return Array.from({ length: highest - 1 }, (_, index) =>
            new URL(`page/${index + 2}/`, base).toString(),
          );
        }),
      ),
    ].slice(0, config.maxListingPages);
    listings.push(...(await fetchInBatches(paginationUrls)));
  }
  const documents: SourceDocument[] = listings.map(({ url, raw }) => ({
    url,
    content: source.kind === "API" ? raw : readableContent(raw),
  }));
  if (source.kind !== "WEB_PAGE" || !config.maxDetailPages) return documents;

  const links = [
    ...new Set(
      listings.flatMap(({ url, raw }) => discoverLinks(raw, url, config)),
    ),
  ].slice(0, config.maxDetailPages);
  const detailPages = await fetchInBatches(links);
  const details = detailPages.map(({ url, raw }) => ({
    url,
    content: readableContent(raw),
  }));
  return config.preferDetailPages && details.length
    ? details
    : [...documents, ...details];
}
