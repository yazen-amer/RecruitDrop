import type { ExtractedEvent } from "./schema";
export const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function similarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ")),
    bb = new Set(normalize(b).split(" "));
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}
export function likelyDuplicate(a: ExtractedEvent, b: ExtractedEvent) {
  if (!a.startAt || !b.startAt) return false;
  const hours = Math.abs(Date.parse(a.startAt) - Date.parse(b.startAt)) / 36e5;
  if (hours > 3) return false;
  if (a.location && b.location && normalize(a.location) !== normalize(b.location)) return false;
  if (a.sourceUrl && b.sourceUrl && canonicalUrl(a.sourceUrl) === canonicalUrl(b.sourceUrl) &&
      /\/event\/|\/events\/\d{4}\/\d{2}\/\d{2}\//.test(new URL(a.sourceUrl).pathname) && similarity(a.title, b.title) >= 0.5)
    return true;
  if (a.company && b.company && normalize(a.company) !== normalize(b.company)) return false;
  if (a.registrationUrl && b.registrationUrl && canonicalUrl(a.registrationUrl) === canonicalUrl(b.registrationUrl)) return true;
  return similarity(a.title, b.title) >= 0.65;
}
export function canonicalUrl(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  [...url.searchParams.keys()]
    .filter((k) => k.startsWith("utm_") || k === "source")
    .forEach((k) => url.searchParams.delete(k));
  return url.toString().replace(/\/$/, "");
}
