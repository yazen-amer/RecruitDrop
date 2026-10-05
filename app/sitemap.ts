import { getSiteUrl } from "@/lib/site-url";
import type { MetadataRoute } from "next";
import { getUpcomingEvents } from "@/lib/events";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  if (!base) return [];
  const pages = ["", "/alerts", "/submit", "/calendar"].map((path) => ({ url: new URL(path || "/", base).href }));
  if (!process.env.DATABASE_URL) return pages;
  const events = await getUpcomingEvents();
  return [...pages, ...events.map((event) => ({ url: new URL(`/events/${event.slug}`, base).href }))];
}
