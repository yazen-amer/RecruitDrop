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
const sourceLabels: Record<string, string> = { "Cornell Events - Public Recruiting Coverage": "Cornell Events", "Cornell Career Network Events": "Cornell Career Network", "USAJOBS - Student-accessible Virtual Career Events": "USAJOBS" };
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
      <time className="date-tile" dateTime={event.startAt} aria-label={d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}>
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
      </time>
      <div className="event-main">
        <Link href={`/events/${event.slug}`} className="event-title">
          {event.title}
        </Link>
        <div className="event-kicker">
          <span className="event-host">{event.company}</span>
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
        {deadline && <p className="deadline-line">Registration deadline: {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>}
      </div>
      <div className="card-actions">
        <button
          onClick={() => toggle(event.id)}
          className={isSaved ? "save-button saved" : "save-button"}
          aria-pressed={isSaved}
          aria-label={isSaved ? `Remove ${event.title} from saved` : `Save ${event.title}`}
        >
          <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </button>
        <a
          className="register-button"
          href={action.href}
          target="_blank"
          rel="noreferrer"
        >
          {action.label} <ExternalLink size={14} />
        </a>
      </div>
      <div className="event-bottom">
        <div className="tags">{event.categories.filter(category => category !== "Other").map(category => <span key={category}>{category}</span>)}</div>
        <div className="card-utilities"><a className="source" href={event.sourceUrl} target="_blank" rel="noreferrer" title={event.sourceName}>via {sourceLabels[event.sourceName] ?? event.sourceName}</a>{!event.isMock && <a className="icon-link" href={`/api/events/${event.slug}/calendar`} aria-label={`Add ${event.title} to calendar`}><CalendarPlus size={16} /></a>}<ShareButton title={event.title} path={`/events/${event.slug}`} /></div>
      </div>
    </article>
  );
}
