import { z } from "zod";

export type SourceDocument = { url: string; content: string };

// Longest matching rule wins; specific RecruitDrop groups override '*'.
export function robotsPolicy(text: string, url: string) {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[]; delay: number }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[], delay: 1 };
  let directives = false;
  for (const line of text.split(/\r?\n/)) {
    const match = line.replace(/#.*/, "").match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const [, field, value] = match;
    if (field.toLowerCase() === "user-agent") {
      if (directives) { groups.push(group); group = { agents: [], rules: [], delay: 1 }; directives = false; }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) {
      directives = true;
      if (/^(allow|disallow)$/i.test(field) && value)
        group.rules.push({ allow: /^allow$/i.test(field), path: value });
      if (/^crawl-delay$/i.test(field) && Number.isFinite(Number(value))) group.delay = Math.max(1, Number(value));
    }
  }
  groups.push(group);
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && "recruitdrop".includes(a)));
  const selected = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const target = new URL(url);
  const path = target.pathname + target.search;
  const matches = selected.flatMap((g) => g.rules).filter((rule) => {
    const pattern = rule.path.split("*").map((part) => part.replace(/[.+?^{}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${pattern}`).test(path);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return { allowed: matches[0]?.allow ?? true, delay: Math.max(1, ...selected.map((g) => g.delay)) * 1000 };
}

const robotsCache = new Map<string, { text: string; expires: number; next: number }>();
async function fetchText(raw: string, redirects = 0): Promise<string> {
  const url = assertPublicUrl(raw);
  if (/(^|\.)joinhandshake\.com$/.test(url.hostname)) throw new Error("Authenticated Handshake sources are not supported");
  let policy = robotsCache.get(url.origin);
  if (!policy || policy.expires < Date.now()) {
    const response = await fetch(new URL("/robots.txt", url), {
      redirect: "manual", signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "RecruitDrop/1.0 (+public Cornell recruiting event index)" },
    });
    if (!response.ok && response.status !== 404) throw new Error(`Robots policy unavailable (${response.status})`);
    policy = { text: response.status === 404 ? "" : await response.text(), expires: Date.now() + 3_600_000, next: 0 };
    robotsCache.set(url.origin, policy);
  }
  const rule = robotsPolicy(policy.text, raw);
  if (!rule.allowed) throw new Error("Source disallowed by robots.txt");
  const wait = Math.max(0, policy.next - Date.now());
  policy.next = Date.now() + wait + rule.delay;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  return requestText(raw, redirects);
}

const sourceConfigSchema = z.object({
  maxDetailPages: z.number().int().min(0).max(120).optional(),
  includePathPatterns: z.array(z.string()).max(12).optional(),
  excludePathPatterns: z.array(z.string()).max(12).optional(),
  calendarMonthsAhead: z.number().int().min(0).max(12).optional(),
  maxListingPages: z.number().int().min(0).max(60).optional(),
  preferDetailPages: z.boolean().optional(),
  intervalHours: z.number().int().min(1).max(168).optional(),
  autoPublishTrusted: z.boolean().optional(),
  disabledReason: z.string().optional(),
  maxApiPages: z.number().int().min(1).max(30).optional(),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export function parseSourceConfig(value: unknown): SourceConfig {
  return sourceConfigSchema.parse(value ?? {});
}

function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Unsupported URL protocol");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    ["localhost", "0.0.0.0", "::1", "::"].includes(host) || /^127\.|^fc[0-9a-f]*:|^fd[0-9a-f]*:|^fe80:|^::ffff:/i.test(host) ||
    host.endsWith(".local") ||
    /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
    throw new Error("Private network URLs are not allowed");
  return url;
}

async function requestText(raw: string, redirects = 0): Promise<string> {
  assertPublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(raw, {
      signal: controller.signal,
      headers: {
        accept:
          "text/html,application/json,application/ld+json,application/xml,text/xml,text/calendar,text/plain",
        "user-agent": "RecruitDrop/1.0 (+public Cornell recruiting event index)",
      },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const target = response.headers.get("location");
      if (!target || redirects >= 5) throw new Error("Invalid source redirect");
      return fetchText(new URL(target, raw).toString(), redirects + 1);
    }
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

async function fetchInBatches(urls: string[], onFailure: (url: string, error: unknown) => void, batchSize = 1) {
  const pages: { url: string; raw: string }[] = [];
  for (let index = 0; index < urls.length; index += batchSize) {
    const settled = await Promise.allSettled(
      urls.slice(index, index + batchSize).map(async (url) => {
        try { return { url, raw: await fetchText(url) }; }
        catch (error) {
          // Retry a timed-out public request once; robots pacing still applies.
          if (error instanceof Error && error.name === "AbortError")
            return { url, raw: await fetchText(url) };
          throw error;
        }
      }),
    );
    for (const [offset, result] of settled.entries())
      if (result.status === "fulfilled") pages.push(result.value);
      else onFailure(urls[index + offset], result.reason);
    if (index + batchSize < urls.length)
      await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return pages;
}

export async function fetchSourceDocuments(source: {
  url: string;
  kind: string;
  config: unknown;
}, onFailure: (url: string, error: unknown) => void = () => {}): Promise<SourceDocument[]> {
  assertPublicUrl(source.url);
  const config = parseSourceConfig(source.config);
  const listingUrls = config.calendarMonthsAhead
    ? calendarListingUrls(source.url, config.calendarMonthsAhead)
    : [source.url];
  const listings = await fetchInBatches(listingUrls, onFailure);
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
    listings.push(...(await fetchInBatches(paginationUrls, onFailure)));
  }
  if (source.kind === "API" && config.maxApiPages) {
    const first = JSON.parse(listings[0].raw) as { page?: { total?: number; current?: number }; total_pages?: number };
    const total = Math.min(first.page?.total ?? first.total_pages ?? 1, config.maxApiPages);
    for (let page = 2; page <= total; page++) {
      const url = new URL(source.url);
      url.searchParams.set("page", String(page));
      listings.push(...await fetchInBatches([url.toString()], onFailure));
    }
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
  const detailPages = await fetchInBatches(links, onFailure);
  const details = detailPages.map(({ url, raw }) => ({
    url,
    content: readableContent(raw),
  }));
  return config.preferDetailPages && details.length
    ? details
    : [...documents, ...details];
}
