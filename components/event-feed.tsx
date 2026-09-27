"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { RecruitingEvent } from "@/lib/types";
import { EventCard } from "./event-card";

const categories = [
  "All areas",
  "SWE",
  "ML / AI",
  "Hardware",
  "Product",
  "Finance",
  "Consulting",
  "Data",
  "Engineering",
  "Healthcare",
  "Marketing / Media",
  "Government / Policy",
  "Science / Biotech",
  "Other",
];
const modes = ["All formats", "In person", "Virtual", "Hybrid"];
const eventTypes = [
  ["ALL", "All event types"], ["INFO_SESSION", "Info sessions"], ["COFFEE_CHAT", "Coffee chats"],
  ["CAREER_FAIR", "Career fairs"], ["TECH_TALK", "Tech talks"], ["INTERVIEW", "Interviews"],
  ["DEADLINE", "Deadlines"], ["WORKSHOP", "Workshops"],
];

export function EventFeed({
  initialEvents,
  isSample,
}: {
  initialEvents: RecruitingEvent[];
  isSample: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All areas");
  const [mode, setMode] = useState("All formats");
  const [sort, setSort] = useState("upcoming");
  const [eventType, setEventType] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [now] = useState(() => Date.now());

  const events = useMemo(
    () =>
      initialEvents
        .filter((event) => {
          const matchesQuery =
            !query ||
            `${event.company} ${event.title}`
              .toLowerCase()
              .includes(query.toLowerCase());
          const matchesCategory =
            category === "All areas" || event.categories.includes(category);
          const matchesMode =
            mode === "All formats" ||
            event.mode === mode.toUpperCase().replace(" ", "_");
          const matchesType = eventType === "ALL" || event.type === eventType;
          const days = dateRange === "7" ? 7 : dateRange === "30" ? 30 : null;
          const matchesDate = !days || Date.parse(event.startAt) <= now + days * 86_400_000;
          return matchesQuery && matchesCategory && matchesMode && matchesType && matchesDate;
        })
        .sort((a, b) =>
          sort === "added"
            ? Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)
            : Date.parse(a.startAt) - Date.parse(b.startAt),
        ),
    [initialEvents, query, category, mode, eventType, dateRange, sort, now],
  );

  function clearFilters() {
    setQuery("");
    setCategory("All areas");
    setMode("All formats");
    setEventType("ALL"); setDateRange("ALL");
  }

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Cornell · Fall recruiting</p>
          <h1>
            Don’t hear about it
            <br />
            <em>the day after.</em>
          </h1>
          <p className="hero-copy">
            Recruiting events, coffee chats, tech talks, and deadlines—pulled
            into one Cornell calendar.
          </p>
        </div>
        <div className="hero-stat">
          <span>Next up</span>
          <b>{initialEvents[0]?.company ?? "New events soon"}</b>
          <p>{initialEvents[0]?.title ?? "Check back after the next source scan"}</p>
        </div>
      </section>

      <section className="filter-bar" aria-label="Event filters">
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search companies and events"
            aria-label="Search events"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="select-row">
          <label className="native-select">
            <SlidersHorizontal size={15} />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Career area"
            >
              {categories.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="native-select"><select value={eventType} onChange={(event) => setEventType(event.target.value)} aria-label="Event type">
            {eventTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <label className="native-select"><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Date range">
            <option value="ALL">Any date</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option>
          </select></label>
          <label className="native-select">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              aria-label="Event format"
            >
              {modes.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="native-select">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort events"
            >
              <option value="upcoming">Soonest first</option>
              <option value="added">Recently added</option>
            </select>
          </label>
        </div>
      </section>

      <div className="feed-heading">
        <div>
          <h2>Upcoming at Cornell</h2>
          <p>{events.length} opportunities on the radar</p>
        </div>
        {isSample && <span className="mock-label">Sample data</span>}
      </div>

      <div className="event-list">
        {events.map((event) => (
          <EventCard event={event} key={event.id} />
        ))}
      </div>

      {!events.length && (
        <div className="empty-state">
          <div className="empty-radar">
            <Search size={25} />
          </div>
          <h3>No events match those filters</h3>
          <p>Try a broader search or clear the filters.</p>
          <button className="clear-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
