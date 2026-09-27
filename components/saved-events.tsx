"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { RecruitingEvent } from "@/lib/types";
import { useSaved } from "./saved-provider";
import { EventCard } from "./event-card";

export function SavedEvents({ events }: { events: RecruitingEvent[] }) {
  const { saved } = useSaved();
  const savedEvents = events.filter((event) => saved.includes(event.id));
  return (
    <div className="subpage">
      <p className="eyebrow">Your shortlist</p>
      <h1>Saved events</h1>
      <p className="subhead">Keep the opportunities you care about in one place.</p>
      {savedEvents.length ? (
        <div className="event-list saved-list">
          {savedEvents.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-radar">
            <Bookmark size={25} />
          </div>
          <h3>Nothing saved yet</h3>
          <p>Bookmark events from the feed and they’ll show up here.</p>
          <Link href="/" className="register-button inline-button">
            Browse events
          </Link>
        </div>
      )}
    </div>
  );
}
