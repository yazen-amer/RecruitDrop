import type { RecruitingEvent } from "./types";
export function eventAction(event: RecruitingEvent, now: number) {
  const closed = Boolean(event.deadline && Date.parse(event.deadline) <= now);
  return { label: closed || event.registrationIsDirect === false ? "View details" : "Register", href: closed ? event.sourceUrl : event.registrationUrl, closed, closingSoon: Boolean(event.deadline && Date.parse(event.deadline) > now && Date.parse(event.deadline) - now <= 7 * 864e5) };
}
export function eventStructuredData(event: RecruitingEvent) {
  if (event.isMock) return null;
  return { "@context": "https://schema.org", "@type": "Event", name: event.title, description: event.description,
    startDate: event.startAt, ...(event.endAt ? { endDate: event.endAt } : {}),
    ...(event.companyKnown !== false ? { organizer: { "@type": "Organization", name: event.company } } : {}),
    ...(event.location && event.location !== "Details pending" && event.mode !== "VIRTUAL" ? { location: { "@type": "Place", name: event.location } } : {}),
    ...(event.mode !== "UNKNOWN" ? { eventAttendanceMode: "https://schema.org/" + ({ IN_PERSON: "OfflineEventAttendanceMode", VIRTUAL: "OnlineEventAttendanceMode", HYBRID: "MixedEventAttendanceMode" }[event.mode]) } : {}),
  };
}
