import { EventFeed } from "@/components/event-feed";
import { getUpcomingEvents, getLastSourceScan } from "@/lib/events";
import { mockEvents } from "@/lib/mock-events";
import { parseFeedFilters } from "@/lib/feed";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") params.set(key, value);
  const isSample = !process.env.DATABASE_URL;
  let events = isSample ? mockEvents : [];
  let lastScan: string | undefined;
  let loadError = false;
  if (!isSample) try { [events, lastScan] = await Promise.all([getUpcomingEvents(), getLastSourceScan()]); }
  catch (error) { console.error("feed_load_failed", error); loadError = true; }
  return <EventFeed initialEvents={events} isSample={isSample} initialFilters={parseFeedFilters(params)} lastScan={lastScan} loadError={loadError} />;
}
