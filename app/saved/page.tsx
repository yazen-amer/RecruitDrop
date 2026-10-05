import { SavedEvents } from "@/components/saved-events";
import { getUpcomingEvents } from "@/lib/events";
import { mockEvents } from "@/lib/mock-events";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const liveEvents = process.env.DATABASE_URL ? await getUpcomingEvents() : [];
  const events = process.env.DATABASE_URL ? liveEvents : mockEvents;
  return <SavedEvents events={events} />;
}
