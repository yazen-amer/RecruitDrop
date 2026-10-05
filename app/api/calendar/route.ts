import { getUpcomingEvents } from "@/lib/events";
import { filterEvents, parseFeedFilters } from "@/lib/feed";
import { calendarContent } from "@/lib/calendar";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return new Response("Calendar unavailable", { status: 503 });
  try {
    const now = new Date();
    const events = filterEvents(await getUpcomingEvents(), parseFeedFilters(new URL(request.url).searchParams), now.getTime());
    return new Response(calendarContent(events, now.toISOString()), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=300", "content-disposition": 'inline; filename="recruitdrop.ics"' } });
  } catch { return new Response("Calendar temporarily unavailable", { status: 503 }); }
}
