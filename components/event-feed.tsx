"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { mockEvents } from "@/lib/mock-events";
import { EventCard } from "./event-card";

const categories = [
  "All areas",
  "SWE",
  "ML / AI",
  "Hardware",
  "Product",
  "Finance",
  "Consulting",
];
const modes = ["All formats", "In person", "Virtual", "Hybrid"];

export function EventFeed() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All areas");
  const [mode, setMode] = useState("All formats");
  const [sort, setSort] = useState("upcoming");

  const events = useMemo(
    () =>
      mockEvents
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
          return matchesQuery && matchesCategory && matchesMode;
        })
        .sort((a, b) =>
          sort === "added"
            ? Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)
            : Date.parse(a.startAt) - Date.parse(b.startAt),
        ),
    [query, category, mode, sort],
  );

  function clearFilters() {
    setQuery("");
    setCategory("All areas");
    setMode("All formats");
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
          <b>Perplexity</b>
          <p>Tech talk · Tomorrow, 6:00 PM</p>
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
        <span className="mock-label">Sample data</span>
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
