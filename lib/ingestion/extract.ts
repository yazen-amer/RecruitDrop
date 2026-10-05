import {
  extractedEventSchema,
  extractionSchema,
  type ExtractedEvent,
} from "./schema";
import { usaJobsEvents } from "./usajobs";

const recruitingTerms =
  /\b(recruit(?:er|ing|ment)?|hiring|career fair|job fair|career workshop|career panel|career exploration|career development|career options|career in|careers week|info(?:rmation)? session|coffee chat|employer|internship|co-?op|on-campus interview|application deadline|tech talk|company presentation|networking event|networking reception|tabling|get to know)\b/i;
const excludedTerms =
  /\b(cancelled|canceled|exhibit|exhibition|concert|performance|(?:graduate|law|medical|business) school fair|study abroad|m\.?eng\.?|master'?s|graduate program|professional certificate|admissions?|research program)\b/i;

function relevant(title: string, description: string) {
  const value = `${title} ${description}`;
  if (/partner meeting|directors roundtable|members.only|by invitation|partner organizations/i.test(title + " " + description)) return false;
  // Alumni advice and student career networking need not use recruiting jargon.
  if (!excludedTerms.test(title) && /\b(?:alumni|alums|students)\b/i.test(value) &&
      /advice on preparing for.*workplace|networking with fellow alumni and current students|career journeys/i.test(description)) return true;
  if (!recruitingTerms.test(value) || excludedTerms.test(title)) return false;
  const descriptionSignals =
    /recruiter|hiring|employer|job openings|full-time roles|internship roles|career opportunities/i;
  if (!recruitingTerms.test(title) && !descriptionSignals.test(description))
    return false;
  if (/tech talk/i.test(title) && !/recruit|internship|career|hiring|employer/i.test(value)) return false;
  if (/info(?:rmation)? session/i.test(title)) {
    const titleSignals = /internship|recruit|career|employer|company|hiring|tech talk|coffee chat/i;
    return titleSignals.test(title) || descriptionSignals.test(description);
  }
  return true;
}

function classifyType(value: string): ExtractedEvent["type"] {
  if (/career fair|job fair/i.test(value)) return "CAREER_FAIR";
  if (/coffee chat/i.test(value)) return "COFFEE_CHAT";
  if (/tech talk/i.test(value)) return "TECH_TALK";
  if (/interview/i.test(value)) return "INTERVIEW";
  if (/deadline/i.test(value)) return "DEADLINE";
  if (/workshop/i.test(value)) return "WORKSHOP";
  if (/info(?:rmation)? session|company presentation/i.test(value))
    return "INFO_SESSION";
  return "OTHER";
}

function classifyCategories(value: string) {
  const categories: ExtractedEvent["careerCategories"] = [];
  if (/software|developer|computing|computer science|cyber|tech\b/i.test(value))
    categories.push("SWE");
  if (/machine learning|artificial intelligence|\bAI\b|data scien/i.test(value))
    categories.push("ML / AI");
  if (/hardware|semiconductor|electrical|manufactur/i.test(value))
    categories.push("Hardware");
  if (/product manage|product design/i.test(value)) categories.push("Product");
  if (/finance|bank|investment|accounting|real estate/i.test(value))
    categories.push("Finance");
  if (/consult/i.test(value)) categories.push("Consulting");
  if (/\bdata\b|analytics/i.test(value) && !categories.includes("ML / AI"))
    categories.push("Data");
  if (/\bengineers?\b|engineering|aerospace|mechanical|energy/i.test(value) && !categories.includes("Hardware"))
    categories.push("Engineering");
  if (/health|medical|pharma|clinical|public health/i.test(value)) categories.push("Healthcare");
  if (/marketing|advertis|media|journalis|communication|entertainment/i.test(value)) categories.push("Marketing / Media");
  if (/government|public policy|public service|politic|international relations/i.test(value)) categories.push("Government / Policy");
  if (/biotech|biology|chemistry|life science|laboratory|scientist/i.test(value)) categories.push("Science / Biotech");
  return categories.length ? categories : ["Other" as const];
}

function inferCompany(title: string) {
  const match = title.trim().match(/^(.*?)\s+(?:[-\u2013\u2014:]\s*)?(?:virtual\s+)?(?:info(?:rmation)? session|coffee chats?|tech talk|recruiting|career fair|job fair|tabling)\b/i);
  if (!match) return null;
  const prefix = match[1].replace(/^(meet|get to know|join)\s+/i, "").trim();
  return prefix && !/cornell|career|engineering|workshop|networking|student|employer|university|college/i.test(prefix) && prefix.length <= 80
    ? prefix
    : null;
}

function validOffsetDate(value: unknown): string | null {
  if (typeof value !== "string" || !/(Z|[+-]\d\d:\d\d)$/.test(value))
    return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

type JsonObject = Record<string, unknown>;

function graduateCalendarEvents(content: string): ExtractedEvent[] | null {
  let body: { events?: JsonObject[]; total_pages?: number };
  try { body = JSON.parse(content); } catch { return null; }
  if (!Array.isArray(body.events) || typeof body.total_pages !== "number") return null;
  return body.events.flatMap((row): ExtractedEvent[] => {
    if (row.all_day === true) return []; // Date-only events do not establish a start time.
    const utc = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? validOffsetDate(value.replace(" ", "T") + "Z") : null;
    const title = typeof row.title === "string" ? decodeEntities(row.title) : "";
    const html = typeof row.description === "string" ? row.description : "";
    const description = decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
    const startAt = utc(row.utc_start_date);
    if (!title || !startAt || Date.parse(startAt) < Date.now() - 3_600_000 || !relevant(title, description)) return [];
    const venue = row.venue as JsonObject | undefined;
    const location = typeof venue?.venue === "string" ? decodeEntities(venue.venue) : null;
    const registration = [...html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .find((match) => /register|registration|rsvp|attend/i.test(match[2].replace(/<[^>]*>/g, "")));
    const value = title + " " + description;
    return [{
      sourceUrl: typeof row.url === "string" ? row.url : undefined,
      company: null, title, description: description || null, startAt, endAt: utc(row.utc_end_date), location,
      mode: row.is_virtual === true || /^(online|virtual|zoom)$/i.test(location ?? "") ? "VIRTUAL" : "UNKNOWN",
      type: classifyType(value), careerCategories: classifyCategories(value),
      registrationUrl: registration ? decodeEntities(registration[1]) : null,
      registrationDeadline: null, confidence: 0.96,
    }];
  });
}

function localistEvents(content: string): ExtractedEvent[] | null {
  let body: unknown;
  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || !("events" in body)) return null;
  const rows = Array.isArray((body as JsonObject).events)
    ? ((body as JsonObject).events as unknown[])
    : [];
  const results: ExtractedEvent[] = [];
  for (const row of rows) {
    const event =
      row && typeof row === "object" && "event" in row
        ? ((row as JsonObject).event as JsonObject)
        : null;
    if (!event || typeof event.title !== "string") continue;
    const description =
      typeof event.description_text === "string" ? event.description_text : "";
    if (!relevant(event.title, description)) continue;
    const instances = Array.isArray(event.event_instances)
      ? event.event_instances
      : [];
    for (const instanceRow of instances as JsonObject[]) {
      const instance = instanceRow?.event_instance as JsonObject | undefined;
      if (instance?.all_day === true) continue; // Midnight is a placeholder, not a verified event time.
      const startAt = validOffsetDate(instance?.start);
      if (!startAt || Date.parse(startAt) < Date.now() - 3_600_000) continue;
      const value = `${event.title} ${description}`;
      const experience = typeof event.experience === "string" ? event.experience : "";
      const streamUrl = typeof event.stream_url === "string" ? event.stream_url : "";
      const location =
        typeof event.location_name === "string" && event.location_name
          ? event.location_name
          : typeof event.location === "string" && event.location
            ? event.location
            : streamUrl
              ? "Online"
              : null;
      const registrationUrl = [event.ticket_url].find(
        (url) => typeof url === "string" && /^https?:\/\//.test(url),
      );
      results.push({
        sourceUrl: typeof event.localist_url === "string" ? event.localist_url : undefined,
        company: inferCompany(event.title),
        title: event.title,
        description: description || null,
        startAt,
        endAt: validOffsetDate(instance?.end),
        location,
        mode:
          experience === "virtual" || streamUrl
            ? "VIRTUAL"
            : experience === "hybrid"
              ? "HYBRID"
              : experience === "inperson"
                ? "IN_PERSON"
                : "UNKNOWN",
        type: classifyType(value),
        careerCategories: classifyCategories(value),
        registrationUrl:
          typeof registrationUrl === "string" ? registrationUrl : null,
        registrationDeadline: /deadline/i.test(event.title) ? startAt : null,
        confidence: 0.96,
      });
    }
  }
  return results;
}

function jsonLdEvents(content: string): ExtractedEvent[] | null {
  const blocks = [
    ...content.matchAll(/__JSON_LD_START__([\s\S]*?)__JSON_LD_END__/g),
  ];
  if (!blocks.length) return null;
  const nodes: JsonObject[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const object = value as JsonObject;
    if (object["@type"] === "Event" ||
        (Array.isArray(object["@type"]) && object["@type"].includes("Event")))
      nodes.push(object);
    if (Array.isArray(object["@graph"])) object["@graph"].forEach(visit);
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block[1]));
    } catch {
      // A broken JSON-LD block should not block the Gemini fallback.
    }
  }
  if (!nodes.length) return null;
  return nodes.flatMap((node): ExtractedEvent[] => {
    const title = typeof node.name === "string" ? node.name : "";
    const description = typeof node.description === "string" ? node.description : "";
    const startAt = validOffsetDate(node.startDate);
    if (!title || !startAt || Date.parse(startAt) < Date.now() - 3_600_000 || !relevant(title, description) || String(node.eventStatus).includes("Cancelled")) return [];
    const locationNode = node.location as JsonObject | undefined;
    const location =
      typeof locationNode?.name === "string"
        ? locationNode.name
        : typeof node.location === "string"
          ? node.location
          : null;
    const attendance = String(node.eventAttendanceMode ?? "");
    const organizer = node.organizer as JsonObject | undefined;
    const offers = node.offers as JsonObject | undefined;
    const value = `${title} ${description}`;
    const registrationUrl = [offers?.url].find(
      (url) => typeof url === "string" && /^https?:\/\//.test(url),
    );
    return [{
      sourceUrl: typeof node.url === "string" ? node.url : undefined,
      company: organizer?.["@type"] === "Corporation" && typeof organizer.name === "string" ? organizer.name : inferCompany(title),
      title,
      description: description || null,
      startAt,
      endAt: validOffsetDate(node.endDate),
      location,
      mode: attendance.includes("Online")
        ? "VIRTUAL"
        : attendance.includes("Mixed")
          ? "HYBRID"
          : attendance.includes("Offline")
            ? "IN_PERSON"
            : "UNKNOWN",
      type: classifyType(value),
      careerCategories: classifyCategories(value),
      registrationUrl:
        typeof registrationUrl === "string" ? registrationUrl : null,
      registrationDeadline: /deadline/i.test(title) ? startAt : null,
      confidence: 0.94,
    }];
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&#8211;|&#x2013;/gi, "–")
    .replace(/&#8212;|&#x2014;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function newYorkIso(year: number, month: number, day: number, hour: number, minute: number) {
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).formatToParts(probe).find((part) => part.type === "timeZoneName")?.value;
  const offset = zone?.match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "-05:00";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
}

function parseClock(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return { hour, minute: Number(match[2] ?? 0) };
}

function uConnectEvent(content: string, sourceUrl?: string): ExtractedEvent[] | null {
  if (!sourceUrl || !/^https:\/\/career\.cornell\.edu\/events\/\d{4}\/\d{2}\/\d{2}\//.test(sourceUrl))
    return null;
  const titleRaw = content.match(/__PAGE_TITLE__([^\n]+)/)?.[1] ?? "";
  const title = decodeEntities(titleRaw).replace(/\s*[–—-]\s*Cornell Career Network\s*$/i, "").trim();
  const date = content.match(/\bDate:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i);
  const time = content.match(/\bTime:\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))(?:\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)))?/i);
  if (!title || !date || !time) return null;
  const month = new Date(`${date[1]} 1, 2000`).getMonth() + 1;
  const startClock = parseClock(time[1]);
  const endClock = time[2] ? parseClock(time[2]) : null;
  if (!month || !startClock) return null;
  const year = Number(date[3]);
  const day = Number(date[2]);
  const startAt = newYorkIso(year, month, day, startClock.hour, startClock.minute);
  if (Date.parse(startAt) < Date.now() - 3_600_000) return [];
  const bodyStart = content.indexOf(time[0]) + time[0].length;
  const bodyEnd = content.indexOf(" Spread the word", bodyStart);
  const description = content.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : bodyStart + 2500)
    .replace(/\s*(?:Join Us|Register|Click here to attend).*$/i, "").trim() || null;
  if (!relevant(title, description ?? "")) return [];
  const registrationUrl = [...content.matchAll(/__URL__(https?:\/\/\S+)/g)]
    .map((match) => match[1])
    .find((url) => /joinhandshake\.com\/events\/|register|zoom\.us|teams\.microsoft/i.test(url)) ?? null;
  const value = `${title} ${description ?? ""}`;
  return [{
    company: inferCompany(title),
    title,
    description,
    startAt,
    endAt: endClock ? newYorkIso(year, month, day, endClock.hour, endClock.minute) : null,
    location: /\b(?:virtual|zoom|online)\b/i.test(value) ? "Online" : null,
    mode: /\b(?:virtual|zoom|online)\b/i.test(value) ? "VIRTUAL" : "UNKNOWN",
    type: classifyType(value),
    careerCategories: classifyCategories(value),
    registrationUrl,
    registrationDeadline: /deadline/i.test(title) ? startAt : null,
    confidence: 0.92,
  }];
}

export function extractStructuredEvents(content: string, sourceUrl?: string) {
  if (sourceUrl && /^https:\/\/career\.cornell\.edu\/events\/(?:\d{4}\/\d{2}\/(?:page\/\d+\/)?)?$/.test(sourceUrl)) return [];
  if (sourceUrl && new URL(sourceUrl).hostname === "www.usajobs.gov" && new URL(sourceUrl).pathname === "/Event") return usaJobsEvents(content, classifyCategories);
  return graduateCalendarEvents(content) ?? localistEvents(content) ?? jsonLdEvents(content) ?? uConnectEvent(content, sourceUrl);
}

const eventJsonSchema = {
  type: "object",
  required: [
    "company", "title", "description", "startAt", "endAt", "location",
    "mode", "type", "careerCategories", "registrationUrl",
    "registrationDeadline", "confidence",
  ],
  properties: {
    company: { type: ["string", "null"] },
    title: { type: "string" },
    description: { type: ["string", "null"] },
    startAt: { type: ["string", "null"] },
    endAt: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    mode: { type: "string", enum: ["IN_PERSON", "VIRTUAL", "HYBRID", "UNKNOWN"] },
    type: { type: "string", enum: ["INFO_SESSION", "TECH_TALK", "COFFEE_CHAT", "INTERVIEW", "CAREER_FAIR", "DEADLINE", "WORKSHOP", "OTHER"] },
    careerCategories: { type: "array", items: { type: "string", enum: ["SWE", "ML / AI", "Hardware", "Product", "Finance", "Consulting", "Data", "Engineering", "Healthcare", "Marketing / Media", "Government / Policy", "Science / Biotech", "Other"] } },
    registrationUrl: { type: ["string", "null"] },
    registrationDeadline: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
};

async function extractWithGemini(content: string, sourceUrl: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = process.env.EXTRACTION_MODEL || "gemini-3.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "Extract only explicit, upcoming recruiting events relevant to Cornell students. Exclude general talks, advising, exhibits, and news. Never invent missing facts. Use null for unknown values. Dates require an explicit UTC offset; Cornell local dates may use the correct America/New_York offset." }],
        },
        contents: [{ role: "user", parts: [{ text: `Current time: ${new Date().toISOString()}\nSource URL: ${sourceUrl}\n\n${content}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            required: ["events"],
            // Large maxItems bounds expand this schema beyond the provider complexity limit.
            // Keep the 50-event bound in extractionSchema instead.
            properties: { events: { type: "array", items: eventJsonSchema } },
          },
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).replaceAll(key, "[redacted]").slice(0, 1000);
    throw new Error(`Gemini extraction returned ${response.status}: ${detail}`);
  }
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const output = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (!output) throw new Error("Gemini returned no structured output");
  return extractionSchema.parse(JSON.parse(output)).events;
}

export async function extractEvents(
  content: string,
  sourceUrl: string,
): Promise<ExtractedEvent[]> {
  const structured = extractStructuredEvents(content, sourceUrl);
  if (structured !== null)
    return structured.map((event) => extractedEventSchema.parse(event));
  return extractWithGemini(content, sourceUrl);
}
