"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { RecruitingEvent } from "@/lib/types";
import { careerAreas, defaultFilters, filterEvents, filterParams, matchesCareerArea, parseFeedFilters, type FeedFilters } from "@/lib/feed";
import { EventCard } from "./event-card";
import { ShareButton } from "./share-button";
const categories = ["All areas", ...careerAreas];
const modes = ["All formats", "In person", "Virtual", "Hybrid"];
const eventTypes = [["ALL", "All event types"], ["INFO_SESSION", "Info sessions"], ["COFFEE_CHAT", "Coffee chats"], ["CAREER_FAIR", "Career fairs"], ["TECH_TALK", "Tech talks"], ["INTERVIEW", "Interviews"], ["DEADLINE", "Deadlines"], ["WORKSHOP", "Workshops"], ["OTHER", "Other career events"]];
const secondaryCount = (filters: FeedFilters) => [filters.eventType !== "ALL", filters.mode !== "All formats", filters.sort !== "upcoming"].filter(Boolean).length;
export function EventFeed({ initialEvents, isSample, initialFilters = defaultFilters, lastScan, loadError = false }: {
  initialEvents: RecruitingEvent[]; isSample: boolean; initialFilters?: FeedFilters; lastScan?: string; loadError?: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [notice, setNotice] = useState("");
  const [moreOpen, setMoreOpen] = useState(() => secondaryCount(initialFilters) > 0);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (filterParams(initialFilters).size) return;
    try {
      const stored = localStorage.getItem("recruitdrop-view");
      if (stored) queueMicrotask(() => {
        const view = parseFeedFilters(new URLSearchParams(stored));
        setFilters(view); setMoreOpen(secondaryCount(view) > 0);
      });
    } catch { /* Browsing works without local storage. */ }
  }, [initialFilters]);
  useEffect(() => {
    const restore = () => {
      const view = parseFeedFilters(new URLSearchParams(window.location.search));
      setFilters(view); setMoreOpen(secondaryCount(view) > 0);
    };
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
  const counts = useMemo(() => Object.fromEntries(categories.map((area) => [area, initialEvents.filter((event) => Date.parse(event.startAt) >= now && matchesCareerArea(event.categories, area)).length])), [initialEvents, now]);
  const activeFilters: [keyof FeedFilters, string][] = [
    ["query", filters.query ? `Search: ${filters.query}` : ""],
    ["category", filters.category === "All areas" ? "" : filters.category === "Other" ? "Unclassified" : filters.category],
    ["dateRange", filters.dateRange === "ALL" ? "" : `Next ${filters.dateRange} days`],
    ["eventType", filters.eventType === "ALL" ? "" : eventTypes.find(([value]) => value === filters.eventType)?.[1] ?? ""],
    ["mode", filters.mode === "All formats" ? "" : filters.mode],
    ["sort", filters.sort === "upcoming" ? "" : "Recently added"],
  ];
  const change = (key: keyof FeedFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  function rememberView() {
    try { localStorage.setItem("recruitdrop-view", filterParams(filters).toString()); setNotice("Default view saved on this device."); }
    catch { setNotice("This browser cannot save preferences. Bookmark or share this view instead."); }
  }
  return <>
    <section className="hero">
      <p className="eyebrow">Cornell career opportunities</p>
      <h1>Don&apos;t hear about it <em>the day after.</em></h1>
      <p className="hero-copy">Recruiting events, employer sessions, and career conversations for Cornell students.</p>
      <p className="hero-evidence"><span><strong>45%+</strong> of surveyed students who attended a career fair received an interview offer afterward.</span><a href="https://www.naceweb.org/talent-acquisition/student-attitudes/more-than-half-of-students-attended-a-career-fair-in-the-past-12-months/" target="_blank" rel="noreferrer">Source: NACE 2024 Student Survey</a></p>
    </section>
    <section className="filter-bar" aria-label="Event filters">
      <div className="primary-filters">
      <label className="search-box"><Search size={18} /><input value={filters.query} onChange={(event) => change("query", event.target.value)} placeholder="Search employers, roles, topics, or locations" aria-label="Search events" />{filters.query && <button onClick={() => change("query", "")} aria-label="Clear search">Clear</button>}</label>
        <label className={`native-select${filters.category !== "All areas" ? " filter-selected" : ""}`}><select value={filters.category} onChange={(event) => change("category", event.target.value)} aria-label="Career area">{categories.map((option) => <option value={option} key={option}>{option === "Other" ? "Other / unclassified" : option} ({counts[option] ?? 0})</option>)}</select></label>
        <label className={`native-select${filters.dateRange !== "ALL" ? " filter-selected" : ""}`}><select value={filters.dateRange} onChange={(event) => change("dateRange", event.target.value)} aria-label="Date range"><option value="ALL">Any date</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option></select></label>
        <button className={`more-filters-button${secondaryCount(filters) ? " filter-selected" : ""}`} aria-expanded={moreOpen} aria-controls="more-filters" onClick={() => setMoreOpen(!moreOpen)}><SlidersHorizontal size={16} />More filters{secondaryCount(filters) > 0 && ` (${secondaryCount(filters)})`}</button>
      </div>
      <div className="secondary-filters" id="more-filters" hidden={!moreOpen}>
        <label>Event type<select value={filters.eventType} onChange={(event) => change("eventType", event.target.value)}>{eventTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Format<select value={filters.mode} onChange={(event) => change("mode", event.target.value)}>{modes.map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Sort by<select value={filters.sort} onChange={(event) => change("sort", event.target.value)}><option value="upcoming">Soonest first</option><option value="added">Recently added</option></select></label>
      </div>
      {filterParams(filters).size > 0 && <div className="active-filters" aria-label="Active filters">{activeFilters.filter(([, label]) => label).map(([key, label]) => <button key={key} onClick={() => change(key, defaultFilters[key])} aria-label={`Remove ${label} filter`}>{label}<X size={13} /></button>)}<button onClick={() => setFilters(defaultFilters)}>Clear all</button></div>}
    </section>
    <div className="radar-tools"><span>{isSample ? "Preview using sample events" : loadError ? "Sources are temporarily unavailable" : lastScan ? `Updated ${new Date(lastScan).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : "Public Cornell sources. Coverage varies by career area."}</span><details className="view-tools"><summary>View options</summary><div className="view-actions"><button className="text-button" onClick={rememberView}>Remember this view</button><ShareButton title="My RecruitDrop radar" /><Link href={`/calendar?${filterParams(filters)}`}>Calendar updates</Link><Link href={filters.category === "All areas" ? "/alerts" : `/alerts?area=${encodeURIComponent(filters.category)}`}>Weekly alerts</Link></div></details>{notice && <span role="status">{notice}</span>}</div>
    <div className="feed-heading"><div><h2>Upcoming opportunities</h2><p aria-live="polite">{events.length} opportunities match your view. Career-area counts overlap.</p></div>{isSample && <span className="mock-label">Sample data</span>}</div>
    <div className="event-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
    {!events.length && <div className="empty-state"><div className="empty-radar"><Search size={25} /></div><h3>{loadError ? "We could not load the radar" : !initialEvents.length ? "No upcoming events listed yet" : "No events match those filters"}</h3><p>{loadError ? "Please refresh in a moment." : "Coverage varies by career area. Try a broader view, or submit a public event we missed."}</p><button className="clear-button" onClick={() => setFilters(defaultFilters)}>Clear filters</button><Link href="/submit">Submit an event</Link></div>}
  </>;
}
