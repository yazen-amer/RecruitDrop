import type { ExtractedEvent } from "./schema";

const clean = (text: string) => text.replace(/__URL__\S+/g, "").replace(/\s+/g, " ").trim();
function clock(text: string) {
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.m\.$/i);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2] ?? 0) > 59) return null;
  return { hour: Number(match[1]) % 12 + (match[3].toLowerCase() === "p" ? 12 : 0), minute: Number(match[2] ?? 0) };
}
function dateStamp(year: number, month: number, day: number, time: NonNullable<ReturnType<typeof clock>>, zone: string) {
  const fixed: Record<string, string> = { EST: "-05:00", EDT: "-04:00", CST: "-06:00", CDT: "-05:00", MST: "-07:00", MDT: "-06:00", PST: "-08:00", PDT: "-07:00" };
  const region: Record<string, string> = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles" };
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const offset = fixed[zone] ?? (region[zone] ? new Intl.DateTimeFormat("en-US", { timeZone: region[zone], timeZoneName: "longOffset" }).formatToParts(date).find(part => part.type === "timeZoneName")?.value.replace("GMT", "") : undefined);
  if (!offset) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:00${offset}`;
}

export function usaJobsEvents(content: string, categories: (text: string) => ExtractedEvent["careerCategories"]): ExtractedEvent[] {
  const decoded = content.replace(/&#(?:x([\da-f]+)|(\d+));/gi, (entity, hex: string, decimal: string) => {
    const point = parseInt(hex || decimal, hex ? 16 : 10); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  }).replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const results: ExtractedEvent[] = [];
  const marker = "X (Opens in a new window)";
  for (const chunk of decoded.split(/&body=https:\/\/www\.usajobs\.gov\/Event\//).slice(1)) {
    const id = chunk.match(/^\d+/)?.[0];
    const index = chunk.indexOf(marker);
    if (!id || index < 0) continue;
    const body = chunk.slice(index + marker.length).trim();
    const header = body.match(/^(.+?)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}(?::\d{2})?\s*[ap]\.m\.)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*[ap]\.m\.)\s+([A-Z]{2,3})\s+Online\s+__URL__(https?:\/\/\S+)\s+Visit event website\s+([\s\S]*?)\s+Expand Hide details and jobs Hosted by\s+([\s\S]*)$/i);
    if (!header) continue; // Unknown dates, time zones, and in-person events stay out.
    const [, title, monthName, day, year, start, end, zone, registrationUrl, rawDescription, rawHost] = header;
    const audienceStart = rawHost.search(/Open to the public|Veterans|Students|Recent graduates|Senior executives|Military spouses|Competitive service|Excepted service/i);
    if (audienceStart < 0) continue;
    // Cut off the next event's teaser and the page's filter controls before testing eligibility.
    const audience = rawHost.slice(audienceStart).split(/\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d|\bFilters\b/)[0];
    if (!/Students|Recent graduates|Open to the public/i.test(audience) || /Senior executives/i.test(audience) || /veterinar|veterans|military spouses/i.test(title)) continue;
    const month = new Date(`${monthName} 1, 2000`).getMonth() + 1;
    const startClock = clock(start), endClock = clock(end);
    if (!month || !startClock || !endClock) continue;
    const startAt = dateStamp(Number(year), month, Number(day), startClock, zone.toUpperCase());
    const endAt = dateStamp(Number(year), month, Number(day), endClock, zone.toUpperCase());
    if (!startAt || !endAt || Date.parse(endAt) <= Date.parse(startAt) || Date.parse(startAt) < Date.now() || Date.parse(startAt) > Date.now() + 180 * 864e5) continue;
    const description = clean(rawDescription) + " Audience: " + clean(audience).replace(/\s+(?:Previous\s+)?\d+(?:\s+\d+)*(?:\s+Next)?\s*$/, "");
    const host = clean(rawHost.slice(0, audienceStart));
    const value = title + " " + description + " " + (host === "Non-DOD And Other Support" ? "" : host);
    const area = categories(value).filter(category => category !== "Other");
    results.push({ sourceUrl: `https://www.usajobs.gov/Event/${id}`, company: host && host !== "Non-DOD And Other Support" ? host : null, title, description, startAt, endAt, location: "Online", mode: "VIRTUAL", type: /job fair|hiring fair/i.test(title) ? "CAREER_FAIR" : /resume|interview tips|application workshop|hiring process/i.test(title) ? "WORKSHOP" : "INFO_SESSION", careerCategories: [...new Set([...area, "Government / Policy" as const])], registrationUrl, registrationDeadline: null, confidence: 0.96 });
  }
  return results;
}
