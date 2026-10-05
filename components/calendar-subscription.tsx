"use client";
import { useEffect, useRef, useState } from "react";
export function CalendarSubscription({ query }: { query: string }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => setUrl(new URL(`/api/calendar${query ? "?" + query : ""}`, window.location.origin).href)); }, [query]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setStatus("Calendar URL copied."); }
    catch { input.current?.select(); setStatus("Select and copy the calendar URL."); }
  }
  return <div className="alert-form"><label>Calendar subscription URL<input ref={input} value={url} readOnly onFocus={(event) => event.currentTarget.select()} /></label><button className="primary-wide" onClick={copy} disabled={!url}>Copy calendar URL</button><p role="status">{status}</p><p>Google Calendar: Other calendars &rarr; From URL. Apple Calendar: File &rarr; New Calendar Subscription. Outlook: Add calendar &rarr; Subscribe from web.</p><p className="form-note">Your calendar app chooses how often to refresh. The URL contains your public filters. Anyone with it can see the same public events.</p></div>;
}
