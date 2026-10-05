import type { RecruitingEvent } from "./types";
const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function fold(line: string) {
  const lines: string[] = [];
  let part = "", bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) { lines.push(part); part = " "; bytes = 1; }
    part += character; bytes += size;
  }
  lines.push(part); return lines.join("\r\n");
}
export function calendarContent(events: RecruitingEvent[], now: string) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RecruitDrop//Cornell Recruiting//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:RecruitDrop radar"];
  for (const event of events) lines.push("BEGIN:VEVENT", `UID:${text(event.id)}@recruitdrop`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(event.startAt)}`, ...(event.endAt ? [`DTEND:${stamp(event.endAt)}`] : []), `SUMMARY:${text(event.title)}`, `DESCRIPTION:${text(event.description)}`, ...(event.location && event.location !== "Details pending" ? [`LOCATION:${text(event.location)}`] : []), `URL:${event.sourceUrl.replace(/[\r\n]/g, "")}`, "END:VEVENT");
  return [...lines, "END:VCALENDAR", ""].map(fold).join("\r\n");
}
