"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Bookmark,
  CalendarDays,
  ExternalLink,
  MapPin,
  Monitor,
} from "lucide-react";
import { RecruitingEvent } from "@/lib/types";
import { useSaved } from "./saved-provider";
const labels: Record<string, string> = {
  INFO_SESSION: "Info session",
  TECH_TALK: "Tech talk",
  COFFEE_CHAT: "Coffee chat",
  INTERVIEW: "Interview",
  CAREER_FAIR: "Career fair",
  DEADLINE: "Deadline",
  WORKSHOP: "Workshop",
};
export function EventCard({ event }: { event: RecruitingEvent }) {
  const { saved, toggle } = useSaved();
  const [now] = useState(() => Date.now());
  const d = new Date(event.startAt);
  const isSaved = saved.includes(event.id);
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const closingSoon = deadline && deadline.getTime() - now < 7 * 86_400_000;
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
          {closingSoon && <span className="deadline-badge">Closing soon</span>}
        </div>
        <Link href={`/events/${event.slug}`} className="event-title">
          {event.title}
        </Link>
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
          <span className="source">via {event.sourceName}</span>
        </div>
        {deadline && <p className="deadline-line">Registration deadline: {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</p>}
      </div>
      <div className="card-actions">
        <button
          onClick={() => toggle(event.id)}
          className={isSaved ? "save-button saved" : "save-button"}
          aria-label={isSaved ? "Remove from saved" : "Save event"}
        >
          <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
        </button>
        <a
          className="register-button"
          href={event.registrationUrl}
          target="_blank"
          rel="noreferrer"
        >
          Register <ExternalLink size={14} />
        </a>
      </div>
    </article>
  );
}
