import type { RecruitingEvent } from "./types";
export const careerAreas = ["SWE", "ML / AI", "Hardware", "Product", "Finance", "Consulting", "Data", "Engineering", "Healthcare", "Marketing / Media", "Government / Policy", "Science / Biotech", "Other"];
export type FeedFilters = { query: string; category: string; mode: string; eventType: string; dateRange: string; sort: string };
export const defaultFilters: FeedFilters = { query: "", category: "All areas", mode: "All formats", eventType: "ALL", dateRange: "ALL", sort: "upcoming" };
export function matchesCareerArea(categories: string[], area: string) {
  return area === "All areas" || categories.includes(area) || (area === "Other" && categories.length === 0);
}
export function parseFeedFilters(params: URLSearchParams): FeedFilters {
  const valid = (key: string, allowed: string[], fallback: string) => allowed.includes(params.get(key) ?? "") ? params.get(key)! : fallback;
  return { query: (params.get("q") ?? "").slice(0, 200), category: valid("area", careerAreas, "All areas"), mode: valid("format", ["In person", "Virtual", "Hybrid"], "All formats"), eventType: valid("type", ["INFO_SESSION", "TECH_TALK", "COFFEE_CHAT", "CAREER_FAIR", "INTERVIEW", "DEADLINE", "WORKSHOP", "OTHER"], "ALL"), dateRange: valid("days", ["7", "30"], "ALL"), sort: valid("sort", ["added"], "upcoming") };
}
export function filterParams(filters: FeedFilters) {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries({ query: "q", category: "area", mode: "format", eventType: "type", dateRange: "days", sort: "sort" })) {
    const name = field as keyof FeedFilters;
    if (filters[name] !== defaultFilters[name]) params.set(key, filters[name]);
  }
  return params;
}
export function filterEvents(events: RecruitingEvent[], filters: FeedFilters, now: number) {
  const words = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return events.filter((event) => {
    const text = [event.company, event.title, event.description, event.location, ...event.categories].join(" ").toLowerCase();
    const start = Date.parse(event.startAt);
    return start >= now && words.every((word) => text.includes(word)) &&
      matchesCareerArea(event.categories, filters.category) &&
      (filters.mode === "All formats" || event.mode === filters.mode.toUpperCase().replace(" ", "_")) &&
      (filters.eventType === "ALL" || event.type === filters.eventType) &&
      (filters.dateRange === "ALL" || start <= now + Number(filters.dateRange) * 864e5);
  }).sort((a, b) => filters.sort === "added" ? Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt) : Date.parse(a.startAt) - Date.parse(b.startAt));
}
