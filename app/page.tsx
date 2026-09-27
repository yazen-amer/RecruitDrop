import { EventFeed } from "@/components/event-feed";
import { getUpcomingEvents } from "@/lib/events";
import { mockEvents } from "@/lib/mock-events";

export const dynamic = "force-dynamic";

export default async function Home() {
  const liveEvents = process.env.DATABASE_URL ? await getUpcomingEvents() : [];
  const isSample = liveEvents.length === 0;
  const events = isSample ? mockEvents : liveEvents;
  return <EventFeed initialEvents={events} isSample={isSample} />;
}
