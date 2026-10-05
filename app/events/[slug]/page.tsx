import { getSiteUrl } from "@/lib/site-url";
import Link from "next/link";
import type { Metadata } from "next";
import { ShareButton } from "@/components/share-button";
import { eventAction, eventStructuredData } from "@/lib/event-presentation";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  ShieldCheck,
  CalendarPlus,
} from "lucide-react";
import { findEvent, mockEvents } from "@/lib/mock-events";
import { getEventBySlug } from "@/lib/events";
import { SaveButton } from "@/components/save-button";
import { EventFeedback } from "@/components/event-feedback";
export function generateStaticParams() {
  return mockEvents.map((e) => ({ slug: e.slug }));
}
export const dynamic = "force-dynamic";
export default async function EventDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = process.env.DATABASE_URL
    ? await getEventBySlug(slug)
    : findEvent(slug);
  if (!event) notFound();
  const d = new Date(event.startAt);
  const action = eventAction(event, new Date().getTime());
  const structured = eventStructuredData(event);
  return (
    <div className="detail-page">
      {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} />}
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Back to all events
      </Link>
      <div className="detail-grid">
        <article>
          <div className="detail-company">
            <span
              className="company-avatar large"
              style={{ background: event.companyColor }}
            >
              {event.companyInitials}
            </span>
            <div>
              <span>Hosted by</span>
              <b>{event.company}</b>
            </div>
          </div>
          <p className="eyebrow">{event.type.replaceAll("_", " ")}</p>
          <h1>{event.title}</h1>
          <div className="detail-tags">
            {event.categories.map((c) => (
              <span key={c}>{c}</span>
            ))}
            {event.isMock && <span className="sample-pill">Sample data</span>}
          </div>
          <section className="description">
            <h2>About this event</h2>
            <p>{event.description}</p>
          </section>
          {!event.isMock && <EventFeedback eventId={event.id} />}
          <section className="source-panel">
            <ShieldCheck size={20} />
            <div>
              <b>Source transparency</b>
              <p>
                Discovered via {event.sourceName}. Details should be verified on
                the original page.
              </p>
              {(event.sources?.length ? event.sources : [{ name: event.sourceName, url: event.sourceUrl }]).map((source) => <p key={source.url + source.name}><a href={source.url} target="_blank" rel="noreferrer">{source.name} <ExternalLink size={13} /></a></p>)}
            </div>
          </section>
        </article>
        <aside className="detail-sidebar">
          <div className="details-card">
            <h2>Event details</h2>
            <div className="detail-row">
              <CalendarDays />
              <div>
                <span>Date</span>
                <b>
                  {d.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric", year: "numeric",
                    timeZone: "America/New_York",
                  })}
                </b>
              </div>
            </div>
            <div className="detail-row">
              <Clock />
              <div>
                <span>Time</span>
                <b>
                  {d.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/New_York",
                  })}{" "}
                  ET
                </b>
              </div>
            </div>
            <div className="detail-row">
              <MapPin />
              <div>
                <span>Location</span>
                <b>{event.location}</b>
              </div>
            </div>
            <a
              className="primary-wide"
              href={action.href}
              target="_blank"
              rel="noreferrer"
            >
              {action.label} <ExternalLink size={15} />
            </a>
            {!event.isMock && <a className="secondary-wide" href={`/api/events/${event.slug}/calendar`}><CalendarPlus size={15} /> Add to calendar</a>}
            {event.companyKnown !== false && <Link className="secondary-wide" href={`/alerts?company=${encodeURIComponent(event.company)}`}>Follow {event.company}</Link>}
            <ShareButton title={event.title} path={`/events/${event.slug}`} />
            {action.closed && <p className="form-error">The listed registration deadline has passed. Check the source for availability.</p>}
            <SaveButton id={event.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = process.env.DATABASE_URL ? await getEventBySlug(slug) : findEvent(slug);
  if (!event) return { title: "Event not found | RecruitDrop", robots: { index: false } };
  const description = event.description.slice(0, 180);
  return { title: event.title + " | RecruitDrop", description, alternates: getSiteUrl() ? { canonical: "/events/" + event.slug } : undefined, openGraph: { title: event.title, description, type: "website", ...(getSiteUrl() ? { url: "/events/" + event.slug } : {}) }, robots: event.isMock || Date.parse(event.startAt) < Date.now() ? { index: false } : undefined };
}
