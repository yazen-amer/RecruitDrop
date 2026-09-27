import { getEventBySlug } from "@/lib/events";

function ics(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = process.env.DATABASE_URL ? await getEventBySlug(slug) : null;
  if (!event) return new Response("Event not found", { status: 404 });
  const end = event.endAt ?? new Date(Date.parse(event.startAt) + 60 * 60 * 1000).toISOString();
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RecruitDrop//Cornell Recruiting//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${event.id}@recruitdrop`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startAt)}`, `DTEND:${stamp(end)}`, `SUMMARY:${ics(event.title)}`,
    `DESCRIPTION:${ics(event.description)}`, `LOCATION:${ics(event.location ?? "")}`, `URL:${event.registrationUrl}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${slug}.ics"` } });
}
