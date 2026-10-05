"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { RecruitingEvent } from "@/lib/types";
import { careerAreas, defaultFilters, filterEvents, filterParams, parseFeedFilters, type FeedFilters } from "@/lib/feed";
import { EventCard } from "./event-card";
import { ShareButton } from "./share-button";
const categories = ["All areas", ...careerAreas];
const modes = ["All formats", "In person", "Virtual", "Hybrid"];
const eventTypes = [["ALL", "All event types"], ["INFO_SESSION", "Info sessions"], ["COFFEE_CHAT", "Coffee chats"], ["CAREER_FAIR", "Career fairs"], ["TECH_TALK", "Tech talks"], ["INTERVIEW", "Interviews"], ["DEADLINE", "Deadlines"], ["WORKSHOP", "Workshops"], ["OTHER", "Other career events"]];
export function EventFeed({ initialEvents, isSample, initialFilters = defaultFilters, lastScan, loadError = false }: {
  initialEvents: RecruitingEvent[]; isSample: boolean; initialFilters?: FeedFilters; lastScan?: string; loadError?: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [notice, setNotice] = useState("");
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (filterParams(initialFilters).size) return;
    try {
      const stored = localStorage.getItem("recruitdrop-view");
      if (stored) queueMicrotask(() => setFilters(parseFeedFilters(new URLSearchParams(stored))));
    } catch { /* Browsing works without local storage. */ }
  }, [initialFilters]);
  useEffect(() => {
    const restore = () => setFilters(parseFeedFilters(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of ["q", "area", "format", "type", "days", "sort"]) url.searchParams.delete(key);
    for (const [key, value] of filterParams(filters)) url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", url);
  }, [filters]);
  const events = useMemo(() => filterEvents(initialEvents, filters, now), [initialEvents, filters, now]);
  const counts = useMemo(() => Object.fromEntries(categories.map((area) => [area, initialEvents.filter((event) => Date.parse(event.startAt) >= now && (area === "All areas" || event.categories.includes(area))).length])), [initialEvents, now]);
  const nextEvent = filterEvents(initialEvents, defaultFilters, now)[0];
  const change = (key: keyof FeedFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  function rememberView() {
    try { localStorage.setItem("recruitdrop-view", filterParams(filters).toString()); setNotice("Default view saved on this device."); }
    catch { setNotice("This browser cannot save preferences. Bookmark or share this view instead."); }
  }
  return <>
    <section className="hero"><div>
      <p className="eyebrow">Cornell &middot; Career opportunities</p>
      <h1>Don&apos;t hear about it<br /><em>the day after.</em></h1>
      <p className="hero-copy">Cornell recruiting events, career workshops, and student-accessible virtual opportunities in one calendar.</p>
    </div><div className="hero-stat"><span>Next up</span><b>{nextEvent?.company ?? "New events soon"}</b><p>{nextEvent?.title ?? "Check back after the next source scan"}</p></div></section>
    <section className="filter-bar" aria-label="Event filters">
      <label className="search-box"><Search size={18} /><input value={filters.query} onChange={(event) => change("query", event.target.value)} placeholder="Search employers, roles, topics, or locations" aria-label="Search events" />{filters.query && <button onClick={() => change("query", "")} aria-label="Clear search">Clear</button>}</label>
      <div className="select-row">
        <label className="native-select"><select value={filters.category} onChange={(event) => change("category", event.target.value)} aria-label="Career area">{categories.map((option) => <option value={option} key={option}>{option} ({counts[option] ?? 0})</option>)}</select></label>
        <label className="native-select"><select value={filters.eventType} onChange={(event) => change("eventType", event.target.value)} aria-label="Event type">{eventTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="native-select"><select value={filters.dateRange} onChange={(event) => change("dateRange", event.target.value)} aria-label="Date range"><option value="ALL">Any date</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option></select></label>
        <label className="native-select"><select value={filters.mode} onChange={(event) => change("mode", event.target.value)} aria-label="Event format">{modes.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label className="native-select"><select value={filters.sort} onChange={(event) => change("sort", event.target.value)} aria-label="Sort events"><option value="upcoming">Soonest first</option><option value="added">Recently added</option></select></label>
      </div>
    </section>
    <div className="radar-tools"><span>{isSample ? "Preview using sample events" : loadError ? "Sources are temporarily unavailable" : lastScan ? `Latest source scan ${new Date(lastScan).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : "Public Cornell sources. Coverage varies by career area."}</span><button className="text-button" onClick={rememberView}>Save this as my default view</button><ShareButton title="My RecruitDrop radar" /><Link href={`/calendar?${filterParams(filters)}`}>Subscribe in my calendar</Link>{notice && <span role="status">{notice}</span>}</div>
    <div className="return-banner"><div><b>Your next opportunity, without another tab to check.</b><p>Save events, add them to your calendar, or choose your weekly alert preferences.</p></div><Link href={filters.category === "All areas" ? "/alerts" : `/alerts?area=${encodeURIComponent(filters.category)}`}>Set up my radar</Link></div>
    <div className="feed-heading"><div><h2>Upcoming opportunities</h2><p aria-live="polite">{events.length} opportunities match your view. Career-area counts overlap.</p></div>{isSample && <span className="mock-label">Sample data</span>}</div>
    <div className="event-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
    {!events.length && <div className="empty-state"><div className="empty-radar"><Search size={25} /></div><h3>{loadError ? "We could not load the radar" : !initialEvents.length ? "No upcoming events listed yet" : "No events match those filters"}</h3><p>{loadError ? "Please refresh in a moment." : "Coverage varies by career area. Try a broader view, or submit a public event we missed."}</p><button className="clear-button" onClick={() => setFilters(defaultFilters)}>Clear filters</button><Link href="/submit">Submit an event</Link></div>}
  </>;
}
