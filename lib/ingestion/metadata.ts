import type { ExtractedEvent } from "./schema";

type Category = ExtractedEvent["careerCategories"][number];
// Match career disciplines, not generic words such as tech, data, energy or health.
const rules: [Category, RegExp][] = [
  ["SWE", /\b(?:software engineering|software developers?|software engineers?|computer science|computing careers?|cybersecurity careers?)\b/i],
  ["ML / AI", /\b(?:machine learning|artificial intelligence|AI (?:engineer|research|career|roles)|data science)\b/i],
  ["Hardware", /\b(?:hardware|semiconductor|electrical engineering|(?:engineering and )?manufacturing careers?)\b/i],
  ["Product", /\b(?:product management|product managers?|product design|strategy and product)\b/i],
  ["Finance", /\b(?:finance|financial services|investment banking|investment management|accounting|real estate|trading careers?)\b/i],
  ["Consulting", /\b(?:consulting|consultants?)\b/i],
  ["Data", /\b(?:data (?:and )?analytics|data analysts?|statistical science|biometry|statistics careers?)\b/i],
  ["Engineering", /\b(?:engineering|engineers?|aerospace|mechanical)\b/i],
  ["Healthcare", /\b(?:healthcare|medicine|medical careers?|clinical careers?|nursing|pharmaceutical careers?)\b/i],
  ["Marketing / Media", /\b(?:marketing|advertising|journalism|film|television|entertainment|media careers?)\b/i],
  ["Science / Biotech", /\b(?:biotech(?:nology)?|biology|chemistry|life science|scientists?|scientific careers?)\b/i],
  ["Government / Policy", /\b(?:government|public policy|public service|federal|international relations|marine officer)\b/i],
];
const organizations: [RegExp, string, Category?][] = [
  [/\bGoldman Sachs\b/i, "Goldman Sachs", "Finance"],
  [/\bBNP Paribas\b/i, "BNP Paribas", "Finance"],
  [/\bJane Street\b/i, "Jane Street", "Finance"],
  [/\bLeft Lane Capital\b/i, "Left Lane Capital", "Finance"],
  [/\bCompass Lexecon\b/i, "Compass Lexecon", "Consulting"],
  [/\bEfficio\b/i, "Efficio", "Consulting"],
  [/\bSpencer Stuart\b/i, "Spencer Stuart", "Consulting"],
  [/\bCooper\s*&\s*Cooper\b/i, "Cooper & Cooper", "Finance"],
  [/\bAbbVie\b/i, "AbbVie", "Healthcare"],
  [/\bVisa(?: Tech)?\b/i, "Visa"],
  [/\bUBS(?: Investment Banking)?\b/i, "UBS", "Finance"],
  [/\bPurposeful Growth Institute\b/i, "Purposeful Growth Institute"],
  [/\bBureau of Prisons\b/i, "Bureau of Prisons", "Government / Policy"],
  [/\bEnvironmental Protection Agency\b/i, "Environmental Protection Agency", "Government / Policy"],
  [/\bAAP Career Development\b/i, "AAP Career Development"],
  [/\b(?:U\.S\. )?Department of Health (?:and|&) Human Services(?: \(HHS\))?\b/i, "Department of Health and Human Services", "Government / Policy"],
];

export function normalizeHost(value: string | null): string | null {
  if (!value) return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || /^(?:unknown|n\/?a|tbd|other|non[- ]dod|various employers|us|our team)$/i.test(name) || /\bTBD\b/i.test(name) || /^(?:20\d{2}\b|(?:Summer|Winter|Fall|Spring)\s+20\d{2}\b)/i.test(name)) return null;
  // Aliases must match the entire name: a department at an employer is not an alias.
  return organizations.find(([pattern]) => {
    const match = name.match(pattern);
    return match?.[0].length === name.length;
  })?.[1] ?? name;
}

export function inferHost(title: string, description = "", explicit: string | null = null): string | null {
  if (normalizeHost(explicit)) return normalizeHost(explicit);
  description = description.split(/(?<=[.!?])\s+|\n+/).filter(sentence => !/\b(?:formerly|former|previously|prior to)\b/i.test(sentence)).join("\n");
  // A mentioned speaker's past employer is not an event organizer.
  for (const [pattern, name] of organizations) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
    if (pattern.test(description) && new RegExp(`(?:hosted by|join|meet|career with|please join)\\s+(?:the\\s+)?${escaped}\\b|${escaped}(?:['’]s|\\s+(?:will be hosting|hosts?\\b))`, "i").test(description)) return name;
  }
  const host = description.match(/\b(?:[Hh]osted|[Oo]rganized|[Pp]resented) by\s+(?:the\s+)?([A-Z][\w&’' -]{2,90}?)(?=[.,;!\n]|\s+(?:for|to|on|and learn)\b|$)/)?.[1]
    ?? description.match(/\b(?:Join|Please join)\s+(?:the\s+)?([A-Z][\w&’' -]{1,90}?)\s+for\b/)?.[1]
    ?? description.match(/\b(?:The\s+)?([A-Z][\w&’' -]{2,90}?)\s+hosts?\s+info(?:rmation)? sessions?\b/)?.[1]
    ?? description.match(/CAREER DAY\s*@\s*([A-Z][A-Z &]{2,60})(?=[!\n]|$)/)?.[1];
  if (normalizeHost(host ?? null)) return normalizeHost(host ?? null);
  const titled = organizations.find(([pattern]) => pattern.test(title));
  if (titled) return titled[1];
  const prefix = title.trim().match(/^(.*?)\s+(?:[-–—:]\s*)?(?:virtual\s+)?(?:info(?:rmation)? session|coffee chats?|tech talk|recruiting|career fair|job fair|tabling)\b/i)?.[1]
    .replace(/^(meet|get to know|join)\s+/i, "").trim();
  return prefix && prefix.length <= 80 && !/cornell|career|engineering|workshop|networking|student|employer|university|college|\b(?:a|the|learn|explore)\b/i.test(prefix) ? normalizeHost(prefix) : null;
}

// Some calendars repeat every speaker's biography on every occurrence. Scope to this date.
export function scopeDescription(description: string, startAt?: string | null): string {
  if (!startAt) return description;
  const headings = [...description.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*:/g)];
  if (headings.length < 2) return description;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" }).formatToParts(new Date(startAt));
  const match = headings.findIndex((heading) => heading[1] === parts.find(p => p.type === "month")?.value && heading[2] === parts.find(p => p.type === "day")?.value);
  if (match < 0) return description;
  return description.slice(0, headings[0].index) + description.slice(headings[match].index, headings[match + 1]?.index);
}

function matchCategories(text: string): Category[] {
  if (/\b(?:leadership|business strategy|using AI|AI tools|resumes?)\b/i.test(text)) text = text.replace(/\bartificial intelligence\b/gi, "");
  const found = rules.filter(([category, pattern]) => pattern.test(category === "Engineering" ? text.replace(/\bsoftware engineer(?:ing|s)?\b/gi, "") : text)).map(([category]) => category);
  return found.filter(category => !(category === "Engineering" && found.includes("Hardware")) && !(category === "Data" && found.includes("ML / AI")));
}

export function careerCategories(title: string, description = "", company: string | null = null, startAt?: string | null): Category[] {
  const scoped = scopeDescription(description, startAt).replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*:[^\n]+(?=\n)/g, "");
  const preparation = /resume|résumé|job seekers?|job search|internship search|application (?:tips|process|workshop)|interview (?:prep|skills)|using (?:AI|ChatGPT)/i.test(title);
  if (preparation) return /federal|government|Bureau of Prisons/i.test(`${title} ${scoped}`) ? ["Government / Policy"] : ["Other"];
  const titleTags = matchCategories(title.replace(/\b(?:College|School|Department) of Engineering\b/gi, ""));
  if (titleTags.length) return titleTags;
  // Ignore addresses, technology/tool usage, and incidental speaker/company history.
  const evidence = scoped.split(/(?<=[.!?])\s+|\n+/).filter(sentence =>
    !/^(?:location|address|contact|registration|copyright)\s*:/i.test(sentence.trim()) &&
    !/\b(?:previously|formerly|former|prior to|AI tools|using ChatGPT|uses? AI|AI-driven|artificial intelligence.*leadership|health and human services)\b/i.test(sentence)
  ).map(sentence => /after graduating|spent time|worked/i.test(sentence) ? sentence.replace(/\([^)]*\)/g, "") : sentence).join(" ");
  const tags = matchCategories(evidence);
  const industry = organizations.find(([, name]) => name === normalizeHost(company))?.[2];
  if (tags.length) return industry === "Government / Policy" && !tags.includes(industry) ? [...tags, industry] : tags;
  return industry && /recruit|internship|career|info(?:rmation)? session|coffee chat|get to know|tabling/i.test(title) ? [industry] : ["Other"];
}

export function improveMetadata(event: ExtractedEvent): ExtractedEvent {
  const company = inferHost(event.title, event.description ?? "", event.company);
  return { ...event, company, careerCategories: careerCategories(event.title, event.description ?? "", company, event.startAt) };
}
