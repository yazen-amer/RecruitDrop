"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ExternalLink,
  MapPin,
  Monitor, CalendarPlus,
} from "lucide-react";
import { RecruitingEvent } from "@/lib/types";
import { ShareButton } from "./share-button";
import { eventAction } from "@/lib/event-presentation";
import { useSaved } from "./saved-provider";
const labels: Record<string, string> = {
  INFO_SESSION: "Info session",
  TECH_TALK: "Tech talk",
  COFFEE_CHAT: "Coffee chat",
  INTERVIEW: "Interview",
  CAREER_FAIR: "Career fair",
  DEADLINE: "Deadline",
  WORKSHOP: "Workshop",
  OTHER: "Career event",
};
export function EventCard({ event }: { event: RecruitingEvent }) {
  const { saved, toggle } = useSaved();
  const [now] = useState(() => Date.now());
  const d = new Date(event.startAt);
  const isSaved = saved.includes(event.id);
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const action = eventAction(event, now);
  const closingSoon = action.closingSoon;
  return (
    <article className="event-card">
      <div className="date-tile">
        <span>
          {d.toLocaleString("en-US", {
            month: "short",
            timeZone: "America/New_York",
          })}
        </span>
        <b>
          {d.toLocaleString("en-US", {
            day: "2-digit",
            timeZone: "America/New_York",
          })}
        </b>
      </div>
      <div className="event-main">
        <Link href={`/events/${event.slug}`} className="event-title">
          {event.title}
        </Link>
        <div className="event-kicker">
          <span
            className="company-avatar"
            style={{ background: event.companyColor }}
          >
            {event.companyInitials}
          </span>
          <span>{event.company}</span>
          <span className="dot">·</span>
          <span>{labels[event.type]}</span>
          {action.closed && <span className="deadline-badge">Registration closed</span>}
          {closingSoon && <span className="deadline-badge">Closing soon</span>}
        </div>
        <div className="event-meta">
          <span>
            <CalendarDays size={15} />
            {d.toLocaleString("en-US", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/New_York",
            })}{" "}
            ET
          </span>
          <span>
            {event.mode === "VIRTUAL" ? (
              <Monitor size={15} />
            ) : (
              <MapPin size={15} />
            )}{" "}
            {event.location}
          </span>
        </div>
        <div className="event-bottom">
          <div className="tags">
            {event.categories.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <a className="source" href={event.sourceUrl} target="_blank" rel="noreferrer">via {event.sourceName}</a>
        </div>
        {deadline && <p className="deadline-line">Registration deadline: {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>}
      </div>
      <div className="card-actions">
        <button
          onClick={() => toggle(event.id)}
          className={isSaved ? "save-button saved" : "save-button"}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved" : "Save event"}
        >
          <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
        </button>
        <a
          className="register-button"
          href={action.href}
          target="_blank"
          rel="noreferrer"
        >
          {action.label} <ExternalLink size={14} />
        </a>
        <div className="card-utilities">{!event.isMock && <a className="icon-link" href={`/api/events/${event.slug}/calendar`} aria-label={`Add ${event.title} to calendar`}><CalendarPlus size={16} /></a>}<ShareButton title={event.title} path={`/events/${event.slug}`} /></div>
      </div>
    </article>
  );
}
