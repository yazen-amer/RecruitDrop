import { getEventBySlug } from "@/lib/events";
import { calendarContent } from "@/lib/calendar";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = process.env.DATABASE_URL ? await getEventBySlug(slug) : null;
  if (!event || event.isMock) return new Response("Event not found", { status: 404 });
  return new Response(calendarContent([event], new Date().toISOString()), { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="recruitdrop-event.ics"' } });
}
