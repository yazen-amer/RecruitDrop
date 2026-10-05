"use client";

import { FormEvent, useState } from "react";

import { careerAreas as categories } from "@/lib/feed";
const types = [["INFO_SESSION", "Info sessions"], ["COFFEE_CHAT", "Coffee chats"], ["CAREER_FAIR", "Career fairs"], ["DEADLINE", "Deadlines"], ["TECH_TALK", "Tech talks"], ["WORKSHOP", "Workshops"], ["INTERVIEW", "Interviews"], ["OTHER", "Other career events"]];

export function AlertForm({ defaultCompany = "", defaultArea = "" }: { defaultCompany?: string; defaultArea?: string }) {
  const [selected, setSelected] = useState<string[]>(categories.includes(defaultArea) ? [defaultArea] : []);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (value: string, values: string[], set: (next: string[]) => void) =>
    set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const data = new FormData(event.currentTarget);
    setFailed(false);
    try {
    const response = await fetch("/api/alerts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"), categories: selected, eventTypes,
        companyNames: String(data.get("companies") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      }),
    });
    const body = await response.json();
    setStatus(body.message ?? body.error ?? "Something went wrong."); setFailed(!response.ok);
    } catch { setFailed(true); setStatus("We could not connect. Please try again."); }
    finally { setBusy(false); }
  }

  return <form className="alert-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" required placeholder="netid@cornell.edu" /></label>
    <fieldset><legend>Career areas <small>Leave blank for all</small></legend><div className="choice-grid">
      {categories.map((value) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value, selected, setSelected)} /> {value}</label>)}
    </div></fieldset>
    <fieldset><legend>Event types <small>Leave blank for all</small></legend><div className="choice-grid">
      {types.map(([value, label]) => <label key={value}><input type="checkbox" checked={eventTypes.includes(value)} onChange={() => toggle(value, eventTypes, setEventTypes)} /> {label}</label>)}
    </div></fieldset>
    <label>Companies to follow <small>Optional, comma-separated</small><input name="companies" defaultValue={defaultCompany} placeholder="Google, Capital One, JPMorgan" /></label>
    <button className="primary-wide" disabled={busy}>{busy ? "Saving…" : "Create my weekly radar"}</button>
    {status && <p className={failed ? "form-error" : "form-status"} role={failed ? "alert" : "status"}>{status}</p>}
    <p className="form-note">We send a confirmation email first. You can unsubscribe from any digest.</p>
  </form>;
}
